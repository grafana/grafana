// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/grafana/grafana/pkg/util/xorm/core"
	"xorm.io/builder"
)

// Update records, bean's non-empty fields are updated contents,
// condiBean' non-empty filds are conditions
// CAUTION:
//
//	1.bool will defaultly be updated content nor conditions
//	 You should call UseBool if you have bool to use.
//	2.float32 & float64 may be not inexact as conditions
func (session *Session) Update(bean any, condiBean ...any) (int64, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	if session.statement.lastError != nil {
		return 0, session.statement.lastError
	}

	v := rValue(bean)
	t := v.Type()

	var colNames []string
	var args []any

	// handle before update processors
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures) // cleanup after used
	if processor, ok := any(bean).(BeforeUpdateProcessor); ok {
		processor.BeforeUpdate()
	}
	// --

	var err error
	var isMap = t.Kind() == reflect.Map
	var isStruct = t.Kind() == reflect.Struct
	if isStruct {
		if err := session.statement.setRefBean(bean); err != nil {
			return 0, err
		}

		if len(session.statement.TableName()) <= 0 {
			return 0, ErrTableNotFound
		}

		if session.statement.ColumnStr == "" {
			colNames, args = session.statement.buildUpdates(bean, false, false,
				false, false, true)
		} else {
			colNames, args, err = session.genUpdateColumns(bean)
			if err != nil {
				return 0, err
			}
		}
	} else if isMap {
		colNames = make([]string, 0)
		args = make([]any, 0)
		bValue := reflect.Indirect(reflect.ValueOf(bean))

		for _, v := range bValue.MapKeys() {
			colNames = append(colNames, session.engine.Quote(v.String())+" = ?")
			args = append(args, bValue.MapIndex(v).Interface())
		}
	} else {
		return 0, ErrParamsType
	}

	table := session.statement.RefTable

	if session.statement.UseAutoTime && table != nil && table.Updated != "" {
		if !session.statement.columnMap.contain(table.Updated) &&
			!session.statement.omitColumnMap.contain(table.Updated) {
			colNames = append(colNames, session.engine.Quote(table.Updated)+" = ?")
			col := table.UpdatedColumn()
			val, t := session.engine.nowTime(col)
			args = append(args, val)

			var colName = col.Name
			if isStruct {
				session.afterClosures = append(session.afterClosures, func(bean any) {
					col := table.GetColumn(colName)
					setColumnTime(bean, col, t)
				})
			}
		}
	}

	// for update action to like "column = column + ?"
	incColumns := session.statement.incrColumns
	for i, colName := range incColumns.colNames {
		colNames = append(colNames, session.engine.Quote(colName)+" = "+session.engine.Quote(colName)+" + ?")
		args = append(args, incColumns.args[i])
	}
	// for update action to like "column = column - ?"
	decColumns := session.statement.decrColumns
	for i, colName := range decColumns.colNames {
		colNames = append(colNames, session.engine.Quote(colName)+" = "+session.engine.Quote(colName)+" - ?")
		args = append(args, decColumns.args[i])
	}
	// for update action to like "column = expression"
	exprColumns := session.statement.exprColumns
	for i, colName := range exprColumns.colNames {
		switch tp := exprColumns.args[i].(type) {
		case string:
			if len(tp) == 0 {
				tp = "''"
			}
			colNames = append(colNames, session.engine.Quote(colName)+"="+tp)
		case *builder.Builder:
			subQuery, subArgs, err := builder.ToSQL(tp)
			if err != nil {
				return 0, err
			}
			colNames = append(colNames, session.engine.Quote(colName)+"=("+subQuery+")")
			args = append(args, subArgs...)
		default:
			colNames = append(colNames, session.engine.Quote(colName)+"=?")
			args = append(args, exprColumns.args[i])
		}
	}

	if err = session.statement.processIDParam(); err != nil {
		return 0, err
	}

	var autoCond builder.Cond
	if !session.statement.noAutoCondition {
		condBeanIsStruct := false
		if len(condiBean) > 0 {
			if c, ok := condiBean[0].(map[string]any); ok {
				autoCond = builder.Eq(c)
			} else {
				ct := reflect.TypeOf(condiBean[0])
				k := ct.Kind()
				if k == reflect.Ptr {
					k = ct.Elem().Kind()
				}
				if k == reflect.Struct {
					var err error
					autoCond, err = session.statement.buildConds(session.statement.RefTable, condiBean[0], true, true, false, true, false)
					if err != nil {
						return 0, err
					}
					condBeanIsStruct = true
				} else {
					return 0, ErrConditionType
				}
			}
		}

		if !condBeanIsStruct && table != nil {
			if col := table.DeletedColumn(); col != nil && !session.statement.unscoped { // tag "deleted" is enabled
				autoCond1 := session.engine.CondDeleted(col)

				if autoCond == nil {
					autoCond = autoCond1
				} else {
					autoCond = autoCond.And(autoCond1)
				}
			}
		}
	}

	st := &session.statement

	var (
		sqlStr   string
		condArgs []any
		condSQL  string
		cond     = session.statement.cond.And(autoCond)

		doIncVer = isStruct && (table != nil && table.Version != "" && session.statement.checkVersion)
		verValue *reflect.Value
	)
	if doIncVer {
		verValue, err = table.VersionColumn().ValueOf(bean)
		if err != nil {
			return 0, err
		}

		if verValue != nil {
			cond = cond.And(builder.Eq{session.engine.Quote(table.Version): verValue.Interface()})
			colNames = append(colNames, session.engine.Quote(table.Version)+" = "+session.engine.Quote(table.Version)+" + 1")
		}
	}

	condSQL, condArgs, err = builder.ToSQL(cond)
	if err != nil {
		return 0, err
	}

	if len(condSQL) > 0 {
		condSQL = "WHERE " + condSQL
	}

	if st.OrderStr != "" {
		condSQL = condSQL + fmt.Sprintf(" ORDER BY %v", st.OrderStr)
	}

	var tableName = session.statement.TableName()
	// TODO: Oracle support needed
	var top string
	if st.LimitN != nil {
		limitValue := *st.LimitN
		if st.Engine.dialect.DBType() == core.MYSQL {
			condSQL = condSQL + fmt.Sprintf(" LIMIT %d", limitValue)
		} else if st.Engine.dialect.DBType() == core.SQLITE {
			tempCondSQL := condSQL + fmt.Sprintf(" LIMIT %d", limitValue)
			cond = cond.And(builder.Expr(fmt.Sprintf("rowid IN (SELECT rowid FROM %v %v)",
				session.engine.Quote(tableName), tempCondSQL), condArgs...))
			condSQL, condArgs, err = builder.ToSQL(cond)
			if err != nil {
				return 0, err
			}
			if len(condSQL) > 0 {
				condSQL = "WHERE " + condSQL
			}
		} else if st.Engine.dialect.DBType() == core.POSTGRES {
			tempCondSQL := condSQL + fmt.Sprintf(" LIMIT %d", limitValue)
			cond = cond.And(builder.Expr(fmt.Sprintf("CTID IN (SELECT CTID FROM %v %v)",
				session.engine.Quote(tableName), tempCondSQL), condArgs...))
			condSQL, condArgs, err = builder.ToSQL(cond)
			if err != nil {
				return 0, err
			}

			if len(condSQL) > 0 {
				condSQL = "WHERE " + condSQL
			}
		}
	}

	if len(colNames) <= 0 {
		return 0, errors.New("no content found to be updated")
	}

	var tableAlias = session.engine.Quote(tableName)
	var fromSQL string
	if session.statement.TableAlias != "" {
		tableAlias = fmt.Sprintf("%s AS %s", tableAlias, session.statement.TableAlias)
	}

	sqlStr = fmt.Sprintf("UPDATE %v%v SET %v %v%v",
		top,
		tableAlias,
		strings.Join(colNames, ", "),
		fromSQL,
		condSQL)

	res, err := session.exec(sqlStr, append(args, condArgs...)...)
	if err != nil {
		return 0, err
	} else if doIncVer {
		if verValue != nil && verValue.IsValid() && verValue.CanSet() {
			session.incrVersionFieldValue(verValue)
		}
	}

	// handle after update processors
	if session.isAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := any(bean).(AfterUpdateProcessor); ok {
			session.engine.logger.Debug("[event]", tableName, " has after update processor")
			processor.AfterUpdate()
		}
	} else {
		lenAfterClosures := len(session.afterClosures)
		if lenAfterClosures > 0 {
			if value, has := session.afterUpdateBeans[bean]; has && value != nil {
				*value = append(*value, session.afterClosures...)
			} else {
				afterClosures := make([]func(any), lenAfterClosures)
				copy(afterClosures, session.afterClosures)
				// FIXME: if bean is a map type, it will panic because map cannot be as map key
				session.afterUpdateBeans[bean] = &afterClosures
			}

		} else {
			if _, ok := any(bean).(AfterUpdateProcessor); ok {
				session.afterUpdateBeans[bean] = nil
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures) // cleanup after used
	// --

	return res.RowsAffected()
}

func (session *Session) genUpdateColumns(bean any) ([]string, []any, error) {
	table := session.statement.RefTable
	colNames := make([]string, 0, len(table.ColumnsSeq()))
	args := make([]any, 0, len(table.ColumnsSeq()))

	for _, col := range table.Columns() {
		if !col.IsVersion && !col.IsCreated && !col.IsUpdated {
			if session.statement.omitColumnMap.contain(col.Name) {
				continue
			}
		}
		fieldValuePtr, err := col.ValueOf(bean)
		if err != nil {
			return nil, nil, err
		}
		fieldValue := *fieldValuePtr

		if col.IsAutoIncrement {
			switch fieldValue.Type().Kind() {
			case reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int, reflect.Int64:
				if fieldValue.Int() == 0 {
					continue
				}
			case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint, reflect.Uint64:
				if fieldValue.Uint() == 0 {
					continue
				}
			case reflect.String:
				if len(fieldValue.String()) == 0 {
					continue
				}
			case reflect.Ptr:
				if fieldValue.Pointer() == 0 {
					continue
				}
			}
		}

		if (col.IsDeleted && !session.statement.unscoped) || col.IsCreated {
			continue
		}

		// if only update specify columns
		if len(session.statement.columnMap) > 0 && !session.statement.columnMap.contain(col.Name) {
			continue
		}

		if session.statement.incrColumns.isColExist(col.Name) {
			continue
		} else if session.statement.decrColumns.isColExist(col.Name) {
			continue
		} else if session.statement.exprColumns.isColExist(col.Name) {
			continue
		}

		// !evalphobia! set fieldValue as nil when column is nullable and zero-value
		if _, ok := getFlagForColumn(session.statement.nullableMap, col); ok {
			if col.Nullable && isZeroValue(fieldValue) {
				var nilValue *int
				fieldValue = reflect.ValueOf(nilValue)
			}
		}

		if col.IsUpdated && session.statement.UseAutoTime /*&& isZero(fieldValue.Interface())*/ {
			// if time is non-empty, then set to auto time
			val, t := session.engine.nowTime(col)
			args = append(args, val)

			var colName = col.Name
			session.afterClosures = append(session.afterClosures, func(bean any) {
				col := table.GetColumn(colName)
				setColumnTime(bean, col, t)
			})
		} else if col.IsVersion && session.statement.checkVersion {
			args = append(args, 1)
		} else {
			arg, err := session.value2Interface(col, fieldValue)
			if err != nil {
				return colNames, args, err
			}
			args = append(args, arg)
		}

		colNames = append(colNames, session.engine.Quote(col.Name)+" = ?")
	}
	return colNames, args, nil
}

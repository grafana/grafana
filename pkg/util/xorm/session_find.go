// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"reflect"
	"strings"

	"xorm.io/builder"
	"xorm.io/core"
)

const (
	tpStruct = iota
	tpNonStruct
)

// Find retrieve records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (session *Session) Find(rowsSlicePtr interface{}, condiBean ...interface{}) error {
	if session.isAutoClose {
		defer session.Close()
	}
	return session.find(rowsSlicePtr, condiBean...)
}

// FindAndCount find the results and also return the counts
func (session *Session) FindAndCount(rowsSlicePtr interface{}, condiBean ...interface{}) (int64, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	session.autoResetStatement = false
	err := session.find(rowsSlicePtr, condiBean...)
	if err != nil {
		return 0, err
	}

	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() != reflect.Slice && sliceValue.Kind() != reflect.Map {
		return 0, errors.New("needs a pointer to a slice or a map")
	}

	sliceElementType := sliceValue.Type().Elem()
	if sliceElementType.Kind() == reflect.Ptr {
		sliceElementType = sliceElementType.Elem()
	}
	session.autoResetStatement = true

	if session.statement.selectStr != "" {
		session.statement.selectStr = ""
	}
	if session.statement.OrderStr != "" {
		session.statement.OrderStr = ""
	}

	return session.Count(reflect.New(sliceElementType).Interface())
}

func (session *Session) find(rowsSlicePtr interface{}, condiBean ...interface{}) error {
	defer session.resetStatement()

	if session.statement.lastError != nil {
		return session.statement.lastError
	}

	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() != reflect.Slice && sliceValue.Kind() != reflect.Map {
		return errors.New("needs a pointer to a slice or a map")
	}

	sliceElementType := sliceValue.Type().Elem()

	var tp = tpStruct
	if session.statement.RefTable == nil {
		if sliceElementType.Kind() == reflect.Ptr {
			if sliceElementType.Elem().Kind() == reflect.Struct {
				pv := reflect.New(sliceElementType.Elem())
				if err := session.statement.setRefValue(pv); err != nil {
					return err
				}
			} else {
				tp = tpNonStruct
			}
		} else if sliceElementType.Kind() == reflect.Struct {
			pv := reflect.New(sliceElementType)
			if err := session.statement.setRefValue(pv); err != nil {
				return err
			}
		} else {
			tp = tpNonStruct
		}
	}

	var table = session.statement.RefTable

	var addedTableName = (len(session.statement.JoinStr) > 0)
	var autoCond builder.Cond
	if tp == tpStruct {
		if !session.statement.noAutoCondition && len(condiBean) > 0 {
			var err error
			autoCond, err = session.statement.buildConds(table, condiBean[0], true, true, false, true, addedTableName)
			if err != nil {
				return err
			}
		} else {
			// !oinume! Add "<col> IS NULL" to WHERE whatever condiBean is given.
			// See https://gitea.com/xorm/xorm/issues/179
			if col := table.DeletedColumn(); col != nil && !session.statement.unscoped { // tag "deleted" is enabled
				var colName = session.engine.Quote(col.Name)
				if addedTableName {
					var nm = session.statement.TableName()
					if len(session.statement.TableAlias) > 0 {
						nm = session.statement.TableAlias
					}
					colName = session.engine.Quote(nm) + "." + colName
				}

				autoCond = session.engine.CondDeleted(col)
			}
		}
	}

	var sqlStr string
	var args []interface{}
	// var err error
	if session.statement.RawSQL == "" {
		if len(session.statement.TableName()) <= 0 {
			return ErrTableNotFound
		}

		var columnStr = session.statement.ColumnStr
		if len(session.statement.selectStr) > 0 {
			columnStr = session.statement.selectStr
		} else {
			if session.statement.JoinStr == "" {
				if columnStr == "" {
					if session.statement.GroupByStr != "" {
						columnStr = session.engine.quoteColumns(session.statement.GroupByStr)
					} else {
						columnStr = session.statement.genColumnStr()
					}
				}
			} else {
				if columnStr == "" {
					if session.statement.GroupByStr != "" {
						columnStr = session.engine.quoteColumns(session.statement.GroupByStr)
					} else {
						columnStr = "*"
					}
				}
			}
			if columnStr == "" {
				columnStr = "*"
			}
		}

		session.statement.cond = session.statement.cond.And(autoCond)
		condSQL, condArgs, err := builder.ToSQL(session.statement.cond)
		if err != nil {
			return err
		}

		args = append(session.statement.joinArgs, condArgs...)
		sqlStr, err = session.statement.genSelectSQL(columnStr, condSQL, true, true)
		if err != nil {
			return err
		}
		// for mssql and use limit
		qs := strings.Count(sqlStr, "?")
		if len(args)*2 == qs {
			args = append(args, args...)
		}
	} else {
		sqlStr = session.statement.RawSQL
		args = session.statement.RawParams
	}

	return session.noCacheFind(table, sliceValue, sqlStr, args...)
}

func (session *Session) noCacheFind(table *core.Table, containerValue reflect.Value, sqlStr string, args ...interface{}) error {
	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	fields, err := rows.Columns()
	if err != nil {
		return err
	}

	var newElemFunc func(fields []string) reflect.Value
	elemType := containerValue.Type().Elem()
	var isPointer bool
	if elemType.Kind() == reflect.Ptr {
		isPointer = true
		elemType = elemType.Elem()
	}
	if elemType.Kind() == reflect.Ptr {
		return errors.New("pointer to pointer is not supported")
	}

	newElemFunc = func(fields []string) reflect.Value {
		switch elemType.Kind() {
		case reflect.Slice:
			slice := reflect.MakeSlice(elemType, len(fields), len(fields))
			x := reflect.New(slice.Type())
			x.Elem().Set(slice)
			return x
		case reflect.Map:
			mp := reflect.MakeMap(elemType)
			x := reflect.New(mp.Type())
			x.Elem().Set(mp)
			return x
		}
		return reflect.New(elemType)
	}

	var containerValueSetFunc func(*reflect.Value, core.PK) error

	if containerValue.Kind() == reflect.Slice {
		containerValueSetFunc = func(newValue *reflect.Value, pk core.PK) error {
			if isPointer {
				containerValue.Set(reflect.Append(containerValue, newValue.Elem().Addr()))
			} else {
				containerValue.Set(reflect.Append(containerValue, newValue.Elem()))
			}
			return nil
		}
	} else {
		keyType := containerValue.Type().Key()
		if len(table.PrimaryKeys) == 0 {
			return errors.New("don't support multiple primary key's map has non-slice key type")
		}
		if len(table.PrimaryKeys) > 1 && keyType.Kind() != reflect.Slice {
			return errors.New("don't support multiple primary key's map has non-slice key type")
		}

		containerValueSetFunc = func(newValue *reflect.Value, pk core.PK) error {
			keyValue := reflect.New(keyType)
			err := convertPKToValue(table, keyValue.Interface(), pk)
			if err != nil {
				return err
			}
			if isPointer {
				containerValue.SetMapIndex(keyValue.Elem(), newValue.Elem().Addr())
			} else {
				containerValue.SetMapIndex(keyValue.Elem(), newValue.Elem())
			}
			return nil
		}
	}

	if elemType.Kind() == reflect.Struct {
		var newValue = newElemFunc(fields)
		dataStruct := rValue(newValue.Interface())
		tb, err := session.engine.autoMapType(dataStruct)
		if err != nil {
			return err
		}
		err = session.rows2Beans(rows, fields, tb, newElemFunc, containerValueSetFunc)
		rows.Close()
		if err != nil {
			return err
		}
		return session.executeProcessors()
	}

	for rows.Next() {
		var newValue = newElemFunc(fields)
		bean := newValue.Interface()

		switch elemType.Kind() {
		case reflect.Slice:
			err = rows.ScanSlice(bean)
		case reflect.Map:
			err = rows.ScanMap(bean)
		default:
			err = rows.Scan(bean)
		}

		if err != nil {
			return err
		}

		if err := containerValueSetFunc(&newValue, nil); err != nil {
			return err
		}
	}
	return rows.Err()
}

func convertPKToValue(table *core.Table, dst interface{}, pk core.PK) error {
	cols := table.PKColumns()
	if len(cols) == 1 {
		return convertAssign(dst, pk[0])
	}

	dst = pk
	return nil
}

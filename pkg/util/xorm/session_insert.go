// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strconv"
	"strings"

	"xorm.io/builder"
	"xorm.io/core"
)

// ErrNoElementsOnSlice represents an error there is no element when insert
var ErrNoElementsOnSlice = errors.New("no element on slice when insert")

// Insert insert one or more beans
func (session *Session) Insert(beans ...interface{}) (int64, error) {
	var affected int64
	var err error

	if session.isAutoClose {
		defer session.Close()
	}

	session.autoResetStatement = false
	defer func() {
		session.autoResetStatement = true
		session.resetStatement()
	}()

	for _, bean := range beans {
		switch bean := bean.(type) {
		case map[string]interface{}:
			cnt, err := session.insertMapInterface(bean)
			if err != nil {
				return affected, err
			}
			affected += cnt
		case []map[string]interface{}:
			for i := 0; i < len(bean); i++ {
				cnt, err := session.insertMapInterface(bean[i])
				if err != nil {
					return affected, err
				}
				affected += cnt
			}
		case map[string]string:
			cnt, err := session.insertMapString(bean)
			if err != nil {
				return affected, err
			}
			affected += cnt
		case []map[string]string:
			for i := 0; i < len(bean); i++ {
				cnt, err := session.insertMapString(bean[i])
				if err != nil {
					return affected, err
				}
				affected += cnt
			}
		default:
			sliceValue := reflect.Indirect(reflect.ValueOf(bean))
			if sliceValue.Kind() == reflect.Slice {
				size := sliceValue.Len()
				if size <= 0 {
					return 0, ErrNoElementsOnSlice
				}

				if session.engine.SupportInsertMany() {
					cnt, err := session.innerInsertMulti(bean)
					if err != nil {
						return affected, err
					}
					affected += cnt
				} else {
					for i := 0; i < size; i++ {
						cnt, err := session.innerInsert(sliceValue.Index(i).Interface())
						if err != nil {
							return affected, err
						}
						affected += cnt
					}
				}
			} else {
				cnt, err := session.innerInsert(bean)
				if err != nil {
					return affected, err
				}
				affected += cnt
			}
		}
	}

	return affected, err
}

func (session *Session) innerInsertMulti(rowsSlicePtr interface{}) (int64, error) {
	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() != reflect.Slice {
		return 0, errors.New("needs a pointer to a slice")
	}

	if sliceValue.Len() <= 0 {
		return 0, errors.New("could not insert a empty slice")
	}

	if err := session.statement.setRefBean(sliceValue.Index(0).Interface()); err != nil {
		return 0, err
	}

	tableName := session.statement.TableName()
	if len(tableName) <= 0 {
		return 0, ErrTableNotFound
	}

	table := session.statement.RefTable
	size := sliceValue.Len()

	var colNames []string
	var colMultiPlaces []string
	var args []interface{}
	var cols []*core.Column

	for i := 0; i < size; i++ {
		v := sliceValue.Index(i)
		vv := reflect.Indirect(v)
		elemValue := v.Interface()
		var colPlaces []string

		// handle BeforeInsertProcessor
		// !nashtsai! does user expect it's same slice to passed closure when using Before()/After() when insert multi??
		for _, closure := range session.beforeClosures {
			closure(elemValue)
		}

		if processor, ok := interface{}(elemValue).(BeforeInsertProcessor); ok {
			processor.BeforeInsert()
		}

		if i == 0 {
			for _, col := range table.Columns() {
				ptrFieldValue, err := col.ValueOfV(&vv)
				if err != nil {
					return 0, err
				}
				fieldValue := *ptrFieldValue
				if col.IsAutoIncrement && isZero(fieldValue.Interface()) {
					continue
				}
				if col.MapType == core.ONLYFROMDB {
					continue
				}
				if col.IsDeleted {
					continue
				}
				if session.statement.omitColumnMap.contain(col.Name) {
					continue
				}
				if len(session.statement.columnMap) > 0 && !session.statement.columnMap.contain(col.Name) {
					continue
				}
				if (col.IsCreated || col.IsUpdated) && session.statement.UseAutoTime {
					val, t := session.engine.nowTime(col)
					args = append(args, val)

					var colName = col.Name
					session.afterClosures = append(session.afterClosures, func(bean interface{}) {
						col := table.GetColumn(colName)
						setColumnTime(bean, col, t)
					})
				} else if col.IsVersion && session.statement.checkVersion {
					args = append(args, 1)
					var colName = col.Name
					session.afterClosures = append(session.afterClosures, func(bean interface{}) {
						col := table.GetColumn(colName)
						setColumnInt(bean, col, 1)
					})
				} else {
					arg, err := session.value2Interface(col, fieldValue)
					if err != nil {
						return 0, err
					}
					args = append(args, arg)
				}

				colNames = append(colNames, col.Name)
				cols = append(cols, col)
				colPlaces = append(colPlaces, "?")
			}
		} else {
			for _, col := range cols {
				ptrFieldValue, err := col.ValueOfV(&vv)
				if err != nil {
					return 0, err
				}
				fieldValue := *ptrFieldValue

				if col.IsAutoIncrement && isZero(fieldValue.Interface()) {
					continue
				}
				if col.MapType == core.ONLYFROMDB {
					continue
				}
				if col.IsDeleted {
					continue
				}
				if session.statement.omitColumnMap.contain(col.Name) {
					continue
				}
				if len(session.statement.columnMap) > 0 && !session.statement.columnMap.contain(col.Name) {
					continue
				}
				if (col.IsCreated || col.IsUpdated) && session.statement.UseAutoTime {
					val, t := session.engine.nowTime(col)
					args = append(args, val)

					var colName = col.Name
					session.afterClosures = append(session.afterClosures, func(bean interface{}) {
						col := table.GetColumn(colName)
						setColumnTime(bean, col, t)
					})
				} else if col.IsVersion && session.statement.checkVersion {
					args = append(args, 1)
					var colName = col.Name
					session.afterClosures = append(session.afterClosures, func(bean interface{}) {
						col := table.GetColumn(colName)
						setColumnInt(bean, col, 1)
					})
				} else {
					arg, err := session.value2Interface(col, fieldValue)
					if err != nil {
						return 0, err
					}
					args = append(args, arg)
				}

				colPlaces = append(colPlaces, "?")
			}
		}
		colMultiPlaces = append(colMultiPlaces, strings.Join(colPlaces, ", "))
	}
	cleanupProcessorsClosures(&session.beforeClosures)

	var sql string
	if session.engine.dialect.DBType() == core.ORACLE {
		temp := fmt.Sprintf(") INTO %s (%v) VALUES (",
			session.engine.Quote(tableName),
			quoteColumns(colNames, session.engine.Quote, ","))
		sql = fmt.Sprintf("INSERT ALL INTO %s (%v) VALUES (%v) SELECT 1 FROM DUAL",
			session.engine.Quote(tableName),
			quoteColumns(colNames, session.engine.Quote, ","),
			strings.Join(colMultiPlaces, temp))
	} else {
		sql = fmt.Sprintf("INSERT INTO %s (%v) VALUES (%v)",
			session.engine.Quote(tableName),
			quoteColumns(colNames, session.engine.Quote, ","),
			strings.Join(colMultiPlaces, "),("))
	}
	res, err := session.exec(sql, args...)
	if err != nil {
		return 0, err
	}

	lenAfterClosures := len(session.afterClosures)
	for i := 0; i < size; i++ {
		elemValue := reflect.Indirect(sliceValue.Index(i)).Addr().Interface()

		// handle AfterInsertProcessor
		if session.isAutoCommit {
			// !nashtsai! does user expect it's same slice to passed closure when using Before()/After() when insert multi??
			for _, closure := range session.afterClosures {
				closure(elemValue)
			}
			if processor, ok := interface{}(elemValue).(AfterInsertProcessor); ok {
				processor.AfterInsert()
			}
		} else {
			if lenAfterClosures > 0 {
				if value, has := session.afterInsertBeans[elemValue]; has && value != nil {
					*value = append(*value, session.afterClosures...)
				} else {
					afterClosures := make([]func(interface{}), lenAfterClosures)
					copy(afterClosures, session.afterClosures)
					session.afterInsertBeans[elemValue] = &afterClosures
				}
			} else {
				if _, ok := interface{}(elemValue).(AfterInsertProcessor); ok {
					session.afterInsertBeans[elemValue] = nil
				}
			}
		}
	}

	cleanupProcessorsClosures(&session.afterClosures)
	return res.RowsAffected()
}

// InsertMulti insert multiple records
func (session *Session) InsertMulti(rowsSlicePtr interface{}) (int64, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() != reflect.Slice {
		return 0, ErrParamsType

	}

	if sliceValue.Len() <= 0 {
		return 0, nil
	}

	return session.innerInsertMulti(rowsSlicePtr)
}

func (session *Session) innerInsert(bean interface{}) (int64, error) {
	if err := session.statement.setRefBean(bean); err != nil {
		return 0, err
	}
	if len(session.statement.TableName()) <= 0 {
		return 0, ErrTableNotFound
	}

	table := session.statement.RefTable

	// handle BeforeInsertProcessor
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures) // cleanup after used

	if processor, ok := interface{}(bean).(BeforeInsertProcessor); ok {
		processor.BeforeInsert()
	}

	colNames, args, err := session.genInsertColumns(bean)
	if err != nil {
		return 0, err
	}

	exprs := session.statement.exprColumns
	colPlaces := strings.Repeat("?, ", len(colNames))
	if exprs.Len() <= 0 && len(colPlaces) > 0 {
		colPlaces = colPlaces[0 : len(colPlaces)-2]
	}

	var tableName = session.statement.TableName()
	var output string

	var buf = builder.NewWriter()
	if _, err := buf.WriteString(fmt.Sprintf("INSERT INTO %s", session.engine.Quote(tableName))); err != nil {
		return 0, err
	}

	if len(colPlaces) <= 0 {
		if session.engine.dialect.DBType() == core.MYSQL {
			if _, err := buf.WriteString(" VALUES ()"); err != nil {
				return 0, err
			}
		} else {
			if _, err := buf.WriteString(fmt.Sprintf("%s DEFAULT VALUES", output)); err != nil {
				return 0, err
			}
		}
	} else {
		if _, err := buf.WriteString(" ("); err != nil {
			return 0, err
		}

		if err := writeStrings(buf, append(colNames, exprs.colNames...), "`", "`"); err != nil {
			return 0, err
		}

		if session.statement.cond.IsValid() {
			if _, err := buf.WriteString(fmt.Sprintf(")%s SELECT ", output)); err != nil {
				return 0, err
			}

			if err := session.statement.writeArgs(buf, args); err != nil {
				return 0, err
			}

			if len(exprs.args) > 0 {
				if _, err := buf.WriteString(","); err != nil {
					return 0, err
				}
			}
			if err := exprs.writeArgs(buf); err != nil {
				return 0, err
			}

			if _, err := buf.WriteString(fmt.Sprintf(" FROM %v WHERE ", session.engine.Quote(tableName))); err != nil {
				return 0, err
			}

			if err := session.statement.cond.WriteTo(buf); err != nil {
				return 0, err
			}
		} else {
			buf.Append(args...)

			if _, err := buf.WriteString(fmt.Sprintf(")%s VALUES (%v",
				output,
				colPlaces)); err != nil {
				return 0, err
			}

			if err := exprs.writeArgs(buf); err != nil {
				return 0, err
			}

			if _, err := buf.WriteString(")"); err != nil {
				return 0, err
			}
		}
	}

	if len(table.AutoIncrement) > 0 && session.engine.dialect.DBType() == core.POSTGRES {
		if _, err := buf.WriteString(" RETURNING " + session.engine.Quote(table.AutoIncrement)); err != nil {
			return 0, err
		}
	}

	sqlStr := buf.String()
	args = buf.Args()

	handleAfterInsertProcessorFunc := func(bean interface{}) {
		if session.isAutoCommit {
			for _, closure := range session.afterClosures {
				closure(bean)
			}
			if processor, ok := interface{}(bean).(AfterInsertProcessor); ok {
				processor.AfterInsert()
			}
		} else {
			lenAfterClosures := len(session.afterClosures)
			if lenAfterClosures > 0 {
				if value, has := session.afterInsertBeans[bean]; has && value != nil {
					*value = append(*value, session.afterClosures...)
				} else {
					afterClosures := make([]func(interface{}), lenAfterClosures)
					copy(afterClosures, session.afterClosures)
					session.afterInsertBeans[bean] = &afterClosures
				}

			} else {
				if _, ok := interface{}(bean).(AfterInsertProcessor); ok {
					session.afterInsertBeans[bean] = nil
				}
			}
		}
		cleanupProcessorsClosures(&session.afterClosures) // cleanup after used
	}

	// for postgres, many of them didn't implement lastInsertId, so we should
	// implemented it ourself.
	if session.engine.dialect.DBType() == core.ORACLE && len(table.AutoIncrement) > 0 {
		res, err := session.queryBytes("select seq_atable.currval from dual", args...)
		if err != nil {
			return 0, err
		}

		defer handleAfterInsertProcessorFunc(bean)

		if table.Version != "" && session.statement.checkVersion {
			verValue, err := table.VersionColumn().ValueOf(bean)
			if err != nil {
				session.engine.logger.Error(err)
			} else if verValue.IsValid() && verValue.CanSet() {
				session.incrVersionFieldValue(verValue)
			}
		}

		if len(res) < 1 {
			return 0, errors.New("insert no error but not returned id")
		}

		idByte := res[0][table.AutoIncrement]
		id, err := strconv.ParseInt(string(idByte), 10, 64)
		if err != nil || id <= 0 {
			return 1, err
		}

		aiValue, err := table.AutoIncrColumn().ValueOf(bean)
		if err != nil {
			session.engine.logger.Error(err)
		}

		if aiValue == nil || !aiValue.IsValid() || !aiValue.CanSet() {
			return 1, nil
		}

		aiValue.Set(int64ToIntValue(id, aiValue.Type()))

		return 1, nil
	} else if len(table.AutoIncrement) > 0 && (session.engine.dialect.DBType() == core.POSTGRES) {
		res, err := session.queryBytes(sqlStr, args...)

		if err != nil {
			return 0, err
		}
		defer handleAfterInsertProcessorFunc(bean)

		if table.Version != "" && session.statement.checkVersion {
			verValue, err := table.VersionColumn().ValueOf(bean)
			if err != nil {
				session.engine.logger.Error(err)
			} else if verValue.IsValid() && verValue.CanSet() {
				session.incrVersionFieldValue(verValue)
			}
		}

		if len(res) < 1 {
			return 0, errors.New("insert successfully but not returned id")
		}

		idByte := res[0][table.AutoIncrement]
		id, err := strconv.ParseInt(string(idByte), 10, 64)
		if err != nil || id <= 0 {
			return 1, err
		}

		aiValue, err := table.AutoIncrColumn().ValueOf(bean)
		if err != nil {
			session.engine.logger.Error(err)
		}

		if aiValue == nil || !aiValue.IsValid() || !aiValue.CanSet() {
			return 1, nil
		}

		aiValue.Set(int64ToIntValue(id, aiValue.Type()))

		return 1, nil
	} else {
		res, err := session.exec(sqlStr, args...)
		if err != nil {
			return 0, err
		}

		defer handleAfterInsertProcessorFunc(bean)

		if table.Version != "" && session.statement.checkVersion {
			verValue, err := table.VersionColumn().ValueOf(bean)
			if err != nil {
				session.engine.logger.Error(err)
			} else if verValue.IsValid() && verValue.CanSet() {
				session.incrVersionFieldValue(verValue)
			}
		}

		if table.AutoIncrement == "" {
			return res.RowsAffected()
		}

		var id int64
		id, err = res.LastInsertId()
		if err != nil || id <= 0 {
			return res.RowsAffected()
		}

		aiValue, err := table.AutoIncrColumn().ValueOf(bean)
		if err != nil {
			session.engine.logger.Error(err)
		}

		if aiValue == nil || !aiValue.IsValid() || !aiValue.CanSet() {
			return res.RowsAffected()
		}

		aiValue.Set(int64ToIntValue(id, aiValue.Type()))

		return res.RowsAffected()
	}
}

// InsertOne insert only one struct into database as a record.
// The in parameter bean must a struct or a point to struct. The return
// parameter is inserted and error
func (session *Session) InsertOne(bean interface{}) (int64, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	return session.innerInsert(bean)
}

// genInsertColumns generates insert needed columns
func (session *Session) genInsertColumns(bean interface{}) ([]string, []interface{}, error) {
	table := session.statement.RefTable
	colNames := make([]string, 0, len(table.ColumnsSeq()))
	args := make([]interface{}, 0, len(table.ColumnsSeq()))

	for _, col := range table.Columns() {
		if col.MapType == core.ONLYFROMDB {
			continue
		}

		if col.IsDeleted {
			continue
		}

		if session.statement.omitColumnMap.contain(col.Name) {
			continue
		}

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

		// !evalphobia! set fieldValue as nil when column is nullable and zero-value
		if _, ok := getFlagForColumn(session.statement.nullableMap, col); ok {
			if col.Nullable && isZeroValue(fieldValue) {
				var nilValue *int
				fieldValue = reflect.ValueOf(nilValue)
			}
		}

		if (col.IsCreated || col.IsUpdated) && session.statement.UseAutoTime /*&& isZero(fieldValue.Interface())*/ {
			// if time is non-empty, then set to auto time
			val, t := session.engine.nowTime(col)
			args = append(args, val)

			var colName = col.Name
			session.afterClosures = append(session.afterClosures, func(bean interface{}) {
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

		colNames = append(colNames, col.Name)
	}
	return colNames, args, nil
}

func (session *Session) insertMapInterface(m map[string]interface{}) (int64, error) {
	if len(m) == 0 {
		return 0, ErrParamsType
	}

	tableName := session.statement.TableName()
	if len(tableName) <= 0 {
		return 0, ErrTableNotFound
	}

	var columns = make([]string, 0, len(m))
	exprs := session.statement.exprColumns
	for k := range m {
		if !exprs.isColExist(k) {
			columns = append(columns, k)
		}
	}
	sort.Strings(columns)

	var args = make([]interface{}, 0, len(m))
	for _, colName := range columns {
		args = append(args, m[colName])
	}

	return session.insertMap(columns, args)
}

func (session *Session) insertMapString(m map[string]string) (int64, error) {
	if len(m) == 0 {
		return 0, ErrParamsType
	}

	tableName := session.statement.TableName()
	if len(tableName) <= 0 {
		return 0, ErrTableNotFound
	}

	var columns = make([]string, 0, len(m))
	exprs := session.statement.exprColumns
	for k := range m {
		if !exprs.isColExist(k) {
			columns = append(columns, k)
		}
	}

	sort.Strings(columns)

	var args = make([]interface{}, 0, len(m))
	for _, colName := range columns {
		args = append(args, m[colName])
	}

	return session.insertMap(columns, args)
}

func (session *Session) insertMap(columns []string, args []interface{}) (int64, error) {
	tableName := session.statement.TableName()
	if len(tableName) <= 0 {
		return 0, ErrTableNotFound
	}

	exprs := session.statement.exprColumns
	w := builder.NewWriter()
	// if insert where
	if session.statement.cond.IsValid() {
		if _, err := w.WriteString(fmt.Sprintf("INSERT INTO %s (", session.engine.Quote(tableName))); err != nil {
			return 0, err
		}

		if err := writeStrings(w, append(columns, exprs.colNames...), "`", "`"); err != nil {
			return 0, err
		}

		if _, err := w.WriteString(") SELECT "); err != nil {
			return 0, err
		}

		if err := session.statement.writeArgs(w, args); err != nil {
			return 0, err
		}

		if len(exprs.args) > 0 {
			if _, err := w.WriteString(","); err != nil {
				return 0, err
			}
			if err := exprs.writeArgs(w); err != nil {
				return 0, err
			}
		}

		if _, err := w.WriteString(fmt.Sprintf(" FROM %s WHERE ", session.engine.Quote(tableName))); err != nil {
			return 0, err
		}

		if err := session.statement.cond.WriteTo(w); err != nil {
			return 0, err
		}
	} else {
		qm := strings.Repeat("?,", len(columns))
		qm = qm[:len(qm)-1]

		if _, err := w.WriteString(fmt.Sprintf("INSERT INTO %s (", session.engine.Quote(tableName))); err != nil {
			return 0, err
		}

		if err := writeStrings(w, append(columns, exprs.colNames...), "`", "`"); err != nil {
			return 0, err
		}
		if _, err := w.WriteString(fmt.Sprintf(") VALUES (%s", qm)); err != nil {
			return 0, err
		}

		w.Append(args...)
		if len(exprs.args) > 0 {
			if _, err := w.WriteString(","); err != nil {
				return 0, err
			}
			if err := exprs.writeArgs(w); err != nil {
				return 0, err
			}
		}
		if _, err := w.WriteString(")"); err != nil {
			return 0, err
		}
	}

	sql := w.String()
	args = w.Args()

	res, err := session.exec(sql, args...)
	if err != nil {
		return 0, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
}

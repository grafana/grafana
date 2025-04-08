// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"errors"
	"reflect"

	"github.com/grafana/grafana/pkg/util/xorm/core"
)

// Get retrieve one record from database, bean's non-empty fields
// will be as conditions
func (session *Session) Get(bean any) (bool, error) {
	if session.isAutoClose {
		defer session.Close()
	}
	return session.get(bean)
}

func (session *Session) get(bean any) (bool, error) {
	defer session.resetStatement()

	if session.statement.lastError != nil {
		return false, session.statement.lastError
	}

	beanValue := reflect.ValueOf(bean)
	if beanValue.Kind() != reflect.Ptr {
		return false, errors.New("needs a pointer to a value")
	} else if beanValue.Elem().Kind() == reflect.Ptr {
		return false, errors.New("a pointer to a pointer is not allowed")
	}

	if beanValue.Elem().Kind() == reflect.Struct {
		if err := session.statement.setRefBean(bean); err != nil {
			return false, err
		}
	}

	var sqlStr string
	var args []any
	var err error

	if session.statement.RawSQL == "" {
		if len(session.statement.TableName()) <= 0 {
			return false, ErrTableNotFound
		}
		session.statement.Limit(1)
		sqlStr, args, err = session.statement.genGetSQL(bean)
		if err != nil {
			return false, err
		}
	} else {
		sqlStr = session.statement.RawSQL
		args = session.statement.RawParams
	}

	table := session.statement.RefTable

	has, err := session.nocacheGet(beanValue.Elem().Kind(), table, bean, sqlStr, args...)
	if err != nil || !has {
		return has, err
	}

	return true, nil
}

func (session *Session) nocacheGet(beanKind reflect.Kind, table *core.Table, bean any, sqlStr string, args ...any) (bool, error) {
	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	if !rows.Next() {
		if rows.Err() != nil {
			return false, rows.Err()
		}
		return false, nil
	}

	switch bean := bean.(type) {
	case sql.NullInt64, sql.NullBool, sql.NullFloat64, sql.NullString:
		return true, rows.Scan(&bean)
	case *sql.NullInt64, *sql.NullBool, *sql.NullFloat64, *sql.NullString:
		return true, rows.Scan(bean)
	case *string:
		var res sql.NullString
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = res.String
		}
		return true, nil
	case *int:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = int(res.Int64)
		}
		return true, nil
	case *int8:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = int8(res.Int64)
		}
		return true, nil
	case *int16:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = int16(res.Int64)
		}
		return true, nil
	case *int32:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = int32(res.Int64)
		}
		return true, nil
	case *int64:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = int64(res.Int64)
		}
		return true, nil
	case *uint:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = uint(res.Int64)
		}
		return true, nil
	case *uint8:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = uint8(res.Int64)
		}
		return true, nil
	case *uint16:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = uint16(res.Int64)
		}
		return true, nil
	case *uint32:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean) = uint32(res.Int64)
		}
		return true, nil
	case *uint64:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = uint64(res.Int64)
		}
		return true, nil
	case *bool:
		var res sql.NullBool
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*bean = res.Bool
		}
		return true, nil
	}

	switch beanKind {
	case reflect.Struct:
		fields, err := rows.Columns()
		if err != nil {
			// WARN: Alougth rows return true, but get fields failed
			return true, err
		}

		scanResults, err := session.row2Slice(rows, fields, bean)
		if err != nil {
			return false, err
		}
		// close it before covert data
		rows.Close()

		dataStruct := rValue(bean)
		_, err = session.slice2Bean(scanResults, fields, bean, &dataStruct, table)
		if err != nil {
			return true, err
		}

		return true, session.executeProcessors()
	case reflect.Slice:
		err = rows.ScanSlice(bean)
	case reflect.Map:
		err = rows.ScanMap(bean)
	case reflect.String, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		err = rows.Scan(bean)
	default:
		err = rows.Scan(bean)
	}

	return true, err
}

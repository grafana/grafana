// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"fmt"
	"reflect"

	"github.com/go-xorm/core"
)

type Rows struct {
	NoTypeCheck bool

	session     *Session
	stmt        *core.Stmt
	rows        *core.Rows
	fields      []string
	fieldsCount int
	beanType    reflect.Type
	lastError   error
}

func newRows(session *Session, bean interface{}) (*Rows, error) {
	rows := new(Rows)
	rows.session = session
	rows.beanType = reflect.Indirect(reflect.ValueOf(bean)).Type()

	defer rows.session.Statement.Init()

	var sqlStr string
	var args []interface{}
	rows.session.Statement.RefTable = rows.session.Engine.TableInfo(bean)
	if rows.session.Statement.RawSQL == "" {
		sqlStr, args = rows.session.Statement.genGetSql(bean)
	} else {
		sqlStr = rows.session.Statement.RawSQL
		args = rows.session.Statement.RawParams
	}

	for _, filter := range rows.session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, rows.session.Statement.RefTable)
	}

	rows.session.saveLastSQL(sqlStr, args)
	var err error
	rows.stmt, err = rows.session.DB().Prepare(sqlStr)
	if err != nil {
		rows.lastError = err
		defer rows.Close()
		return nil, err
	}

	rows.rows, err = rows.stmt.Query(args...)
	if err != nil {
		rows.lastError = err
		defer rows.Close()
		return nil, err
	}

	rows.fields, err = rows.rows.Columns()
	if err != nil {
		rows.lastError = err
		defer rows.Close()
		return nil, err
	}
	rows.fieldsCount = len(rows.fields)

	return rows, nil
}

// move cursor to next record, return false if end has reached
func (rows *Rows) Next() bool {
	if rows.lastError == nil && rows.rows != nil {
		hasNext := rows.rows.Next()
		if !hasNext {
			rows.lastError = sql.ErrNoRows
		}
		return hasNext
	}
	return false
}

// Err returns the error, if any, that was encountered during iteration. Err may be called after an explicit or implicit Close.
func (rows *Rows) Err() error {
	return rows.lastError
}

// scan row record to bean properties
func (rows *Rows) Scan(bean interface{}) error {
	if rows.lastError != nil {
		return rows.lastError
	}

	if !rows.NoTypeCheck && reflect.Indirect(reflect.ValueOf(bean)).Type() != rows.beanType {
		return fmt.Errorf("scan arg is incompatible type to [%v]", rows.beanType)
	}

	return rows.session.row2Bean(rows.rows, rows.fields, rows.fieldsCount, bean)

	// result, err := row2map(rows.rows, rows.fields) // !nashtsai! TODO remove row2map then scanMapIntoStruct conversation for better performance
	// if err == nil {
	// 	err = rows.session.scanMapIntoStruct(bean, result)
	// }
	// return err
}

// // Columns returns the column names. Columns returns an error if the rows are closed, or if the rows are from QueryRow and there was a deferred error.
// func (rows *Rows) Columns() ([]string, error) {
// 	if rows.lastError == nil && rows.rows != nil {
// 		return rows.rows.Columns()
// 	}
// 	return nil, rows.lastError
// }

// close session if session.IsAutoClose is true, and claimed any opened resources
func (rows *Rows) Close() error {
	if rows.session.IsAutoClose {
		defer rows.session.Close()
	}

	if rows.lastError == nil {
		if rows.rows != nil {
			rows.lastError = rows.rows.Close()
			if rows.lastError != nil {
				defer rows.stmt.Close()
				return rows.lastError
			}
		}
		if rows.stmt != nil {
			rows.lastError = rows.stmt.Close()
		}
	} else {
		if rows.stmt != nil {
			defer rows.stmt.Close()
		}
		if rows.rows != nil {
			defer rows.rows.Close()
		}
	}
	return rows.lastError
}

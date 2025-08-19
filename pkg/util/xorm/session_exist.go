// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/util/xorm/core"
	"xorm.io/builder"
)

// Exist returns true if the record exist otherwise return false
func (session *Session) Exist(bean ...any) (bool, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	if session.statement.lastError != nil {
		return false, session.statement.lastError
	}

	var sqlStr string
	var args []any
	var joinStr string
	var err error
	if session.statement.RawSQL == "" {
		if len(bean) == 0 {
			tableName := session.statement.TableName()
			if len(tableName) <= 0 {
				return false, ErrTableNotFound
			}

			tableName = session.statement.Engine.Quote(tableName)
			if len(session.statement.JoinStr) > 0 {
				joinStr = session.statement.JoinStr
			}

			if session.statement.cond.IsValid() {
				condSQL, condArgs, err := builder.ToSQL(session.statement.cond)
				if err != nil {
					return false, err
				}

				if session.engine.dialect.DBType() == core.ORACLE {
					sqlStr = fmt.Sprintf("SELECT * FROM %s WHERE (%s) %s AND ROWNUM=1", tableName, joinStr, condSQL)
				} else {
					sqlStr = fmt.Sprintf("SELECT * FROM %s %s WHERE %s LIMIT 1", tableName, joinStr, condSQL)
				}
				args = condArgs
			} else {
				if session.engine.dialect.DBType() == core.ORACLE {
					sqlStr = fmt.Sprintf("SELECT * FROM  %s %s WHERE ROWNUM=1", tableName, joinStr)
				} else {
					sqlStr = fmt.Sprintf("SELECT * FROM %s %s LIMIT 1", tableName, joinStr)
				}
				args = []any{}
			}
		} else {
			beanValue := reflect.ValueOf(bean[0])
			if beanValue.Kind() != reflect.Ptr {
				return false, errors.New("needs a pointer")
			}

			if beanValue.Elem().Kind() == reflect.Struct {
				if err := session.statement.setRefBean(bean[0]); err != nil {
					return false, err
				}
			}

			if len(session.statement.TableName()) <= 0 {
				return false, ErrTableNotFound
			}
			session.statement.Limit(1)
			sqlStr, args, err = session.statement.genGetSQL(bean[0])
			if err != nil {
				return false, err
			}
		}
	} else {
		sqlStr = session.statement.RawSQL
		args = session.statement.RawParams
	}

	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	if rows.Next() {
		return true, nil
	}
	return false, rows.Err()
}

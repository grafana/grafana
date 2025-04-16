// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"reflect"
	"time"

	"xorm.io/builder"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

func (session *Session) queryPreprocess(sqlStr *string, paramStr ...any) {
	for _, filter := range session.engine.dialect.Filters() {
		*sqlStr = filter.Do(*sqlStr, session.engine.dialect, session.statement.RefTable)
	}

	session.lastSQL = *sqlStr
	session.lastSQLArgs = paramStr
}

func (session *Session) queryRows(sqlStr string, args ...any) (*core.Rows, error) {
	defer session.resetStatement()

	session.queryPreprocess(&sqlStr, args...)

	if session.showSQL {
		session.lastSQL = sqlStr
		session.lastSQLArgs = args
		if session.engine.showExecTime {
			b4ExecTime := time.Now()
			defer func() {
				execDuration := time.Since(b4ExecTime)
				if len(args) > 0 {
					session.engine.logger.Infof("[SQL] %s %#v - took: %v", sqlStr, args, execDuration)
				} else {
					session.engine.logger.Infof("[SQL] %s - took: %v", sqlStr, execDuration)
				}
			}()
		} else {
			if len(args) > 0 {
				session.engine.logger.Infof("[SQL] %v %#v", sqlStr, args)
			} else {
				session.engine.logger.Infof("[SQL] %v", sqlStr)
			}
		}
	}

	if session.isAutoCommit {
		db := session.DB()
		if session.prepareStmt {
			// don't clear stmt since session will cache them
			stmt, err := session.doPrepare(db, sqlStr)
			if err != nil {
				return nil, err
			}

			rows, err := stmt.QueryContext(session.ctx, args...)
			if err != nil {
				return nil, err
			}
			return rows, nil
		}

		rows, err := db.QueryContext(session.ctx, sqlStr, args...)
		if err != nil {
			return nil, err
		}
		return rows, nil
	}

	rows, err := session.tx.QueryContext(session.ctx, sqlStr, args...)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (session *Session) queryRow(sqlStr string, args ...any) *core.Row {
	return core.NewRow(session.queryRows(sqlStr, args...))
}

func value2Bytes(rawValue *reflect.Value) ([]byte, error) {
	str, err := value2String(rawValue)
	if err != nil {
		return nil, err
	}
	return []byte(str), nil
}

func row2map(rows *core.Rows, fields []string) (resultsMap map[string][]byte, err error) {
	result := make(map[string][]byte)
	scanResultContainers := make([]any, len(fields))
	for i := 0; i < len(fields); i++ {
		var scanResultContainer any
		scanResultContainers[i] = &scanResultContainer
	}
	if err := rows.Scan(scanResultContainers...); err != nil {
		return nil, err
	}

	for ii, key := range fields {
		rawValue := reflect.Indirect(reflect.ValueOf(scanResultContainers[ii]))
		//if row is null then ignore
		if rawValue.Interface() == nil {
			result[key] = []byte{}
			continue
		}

		if data, err := value2Bytes(&rawValue); err == nil {
			result[key] = data
		} else {
			return nil, err // !nashtsai! REVIEW, should return err or just error log?
		}
	}
	return result, nil
}

func rows2maps(rows *core.Rows) (resultsSlice []map[string][]byte, err error) {
	fields, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		result, err := row2map(rows, fields)
		if err != nil {
			return nil, err
		}
		resultsSlice = append(resultsSlice, result)
	}

	return resultsSlice, nil
}

func (session *Session) queryBytes(sqlStr string, args ...any) ([]map[string][]byte, error) {
	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return rows2maps(rows)
}

func (session *Session) exec(sqlStr string, args ...any) (sql.Result, error) {
	defer session.resetStatement()

	session.queryPreprocess(&sqlStr, args...)

	if session.engine.showSQL {
		if session.engine.showExecTime {
			b4ExecTime := time.Now()
			defer func() {
				execDuration := time.Since(b4ExecTime)
				if len(args) > 0 {
					session.engine.logger.Infof("[SQL] %s %#v - took: %v", sqlStr, args, execDuration)
				} else {
					session.engine.logger.Infof("[SQL] %s - took: %v", sqlStr, execDuration)
				}
			}()
		} else {
			if len(args) > 0 {
				session.engine.logger.Infof("[SQL] %v %#v", sqlStr, args)
			} else {
				session.engine.logger.Infof("[SQL] %v", sqlStr)
			}
		}
	}

	if !session.isAutoCommit {
		return session.tx.ExecContext(session.ctx, sqlStr, args...)
	}

	if session.prepareStmt {
		stmt, err := session.doPrepare(session.DB(), sqlStr)
		if err != nil {
			return nil, err
		}

		res, err := stmt.ExecContext(session.ctx, args...)
		if err != nil {
			return nil, err
		}
		return res, nil
	}

	return session.DB().ExecContext(session.ctx, sqlStr, args...)
}

func convertSQLOrArgs(sqlOrArgs ...any) (string, []any, error) {
	switch sqlOrArgs[0].(type) {
	case string:
		return sqlOrArgs[0].(string), sqlOrArgs[1:], nil
	case *builder.Builder:
		return sqlOrArgs[0].(*builder.Builder).ToSQL()
	case builder.Builder:
		bd := sqlOrArgs[0].(builder.Builder)
		return bd.ToSQL()
	}

	return "", nil, ErrUnSupportedType
}

// Exec raw sql
func (session *Session) Exec(sqlOrArgs ...any) (sql.Result, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	if len(sqlOrArgs) == 0 {
		return nil, ErrUnSupportedType
	}

	sqlStr, args, err := convertSQLOrArgs(sqlOrArgs...)
	if err != nil {
		return nil, err
	}

	return session.exec(sqlStr, args...)
}

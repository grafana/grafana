// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"

	"xorm.io/core"
)

// Delete records, bean's non-empty fields are conditions
func (session *Session) Delete(bean interface{}) (int64, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	if session.statement.lastError != nil {
		return 0, session.statement.lastError
	}

	if err := session.statement.setRefBean(bean); err != nil {
		return 0, err
	}

	// handle before delete processors
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures)

	if processor, ok := interface{}(bean).(BeforeDeleteProcessor); ok {
		processor.BeforeDelete()
	}

	condSQL, condArgs, err := session.statement.genConds(bean)
	if err != nil {
		return 0, err
	}
	pLimitN := session.statement.LimitN
	if len(condSQL) == 0 && (pLimitN == nil || *pLimitN == 0) {
		return 0, ErrNeedDeletedCond
	}

	var tableNameNoQuote = session.statement.TableName()
	var tableName = session.engine.Quote(tableNameNoQuote)
	var table = session.statement.RefTable
	var deleteSQL string
	if len(condSQL) > 0 {
		deleteSQL = fmt.Sprintf("DELETE FROM %v WHERE %v", tableName, condSQL)
	} else {
		deleteSQL = fmt.Sprintf("DELETE FROM %v", tableName)
	}

	var orderSQL string
	if len(session.statement.OrderStr) > 0 {
		orderSQL += fmt.Sprintf(" ORDER BY %s", session.statement.OrderStr)
	}
	if pLimitN != nil && *pLimitN > 0 {
		limitNValue := *pLimitN
		orderSQL += fmt.Sprintf(" LIMIT %d", limitNValue)
	}

	if len(orderSQL) > 0 {
		switch session.engine.dialect.DBType() {
		case core.POSTGRES:
			inSQL := fmt.Sprintf("ctid IN (SELECT ctid FROM %s%s)", tableName, orderSQL)
			if len(condSQL) > 0 {
				deleteSQL += " AND " + inSQL
			} else {
				deleteSQL += " WHERE " + inSQL
			}
		case core.SQLITE:
			inSQL := fmt.Sprintf("rowid IN (SELECT rowid FROM %s%s)", tableName, orderSQL)
			if len(condSQL) > 0 {
				deleteSQL += " AND " + inSQL
			} else {
				deleteSQL += " WHERE " + inSQL
			}
		default:
			deleteSQL += orderSQL
		}
	}

	var realSQL string

	if session.statement.unscoped || table.DeletedColumn() == nil { // tag "deleted" is disabled
		realSQL = deleteSQL
	} else {
		deletedColumn := table.DeletedColumn()
		realSQL = fmt.Sprintf("UPDATE %v SET %v = ? WHERE %v",
			session.engine.Quote(session.statement.TableName()),
			session.engine.Quote(deletedColumn.Name),
			condSQL)

		if len(orderSQL) > 0 {
			switch session.engine.dialect.DBType() {
			case core.POSTGRES:
				inSQL := fmt.Sprintf("ctid IN (SELECT ctid FROM %s%s)", tableName, orderSQL)
				if len(condSQL) > 0 {
					realSQL += " AND " + inSQL
				} else {
					realSQL += " WHERE " + inSQL
				}
			case core.SQLITE:
				inSQL := fmt.Sprintf("rowid IN (SELECT rowid FROM %s%s)", tableName, orderSQL)
				if len(condSQL) > 0 {
					realSQL += " AND " + inSQL
				} else {
					realSQL += " WHERE " + inSQL
				}
			default:
				realSQL += orderSQL
			}
		}

		// !oinume! Insert nowTime to the head of session.statement.Params
		condArgs = append(condArgs, "")
		paramsLen := len(condArgs)
		copy(condArgs[1:paramsLen], condArgs[0:paramsLen-1])

		val, t := session.engine.nowTime(deletedColumn)
		condArgs[0] = val

		var colName = deletedColumn.Name
		session.afterClosures = append(session.afterClosures, func(bean interface{}) {
			col := table.GetColumn(colName)
			setColumnTime(bean, col, t)
		})
	}
	session.statement.RefTable = table
	res, err := session.exec(realSQL, condArgs...)
	if err != nil {
		return 0, err
	}

	// handle after delete processors
	if session.isAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := interface{}(bean).(AfterDeleteProcessor); ok {
			processor.AfterDelete()
		}
	} else {
		lenAfterClosures := len(session.afterClosures)
		if lenAfterClosures > 0 {
			if value, has := session.afterDeleteBeans[bean]; has && value != nil {
				*value = append(*value, session.afterClosures...)
			} else {
				afterClosures := make([]func(interface{}), lenAfterClosures)
				copy(afterClosures, session.afterClosures)
				session.afterDeleteBeans[bean] = &afterClosures
			}
		} else {
			if _, ok := interface{}(bean).(AfterDeleteProcessor); ok {
				session.afterDeleteBeans[bean] = nil
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures)

	return res.RowsAffected()
}

// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import "xorm.io/builder"

// Sql provides raw sql input parameter. When you have a complex SQL statement
// and cannot use Where, Id, In and etc. Methods to describe, you can use SQL.
//
// Deprecated: use SQL instead.
func (session *Session) Sql(query string, args ...any) *Session {
	return session.SQL(query, args...)
}

// SQL provides raw sql input parameter. When you have a complex SQL statement
// and cannot use Where, Id, In and etc. Methods to describe, you can use SQL.
func (session *Session) SQL(query any, args ...any) *Session {
	session.statement.SQL(query, args...)
	return session
}

// Where provides custom query condition.
func (session *Session) Where(query any, args ...any) *Session {
	session.statement.Where(query, args...)
	return session
}

// And provides custom query condition.
func (session *Session) And(query any, args ...any) *Session {
	session.statement.And(query, args...)
	return session
}

// Or provides custom query condition.
func (session *Session) Or(query any, args ...any) *Session {
	session.statement.Or(query, args...)
	return session
}

// Id provides converting id as a query condition
//
// Deprecated: use ID instead
func (session *Session) Id(id any) *Session {
	return session.ID(id)
}

// ID provides converting id as a query condition
func (session *Session) ID(id any) *Session {
	session.statement.ID(id)
	return session
}

// In provides a query string like "id in (1, 2, 3)" using the AND conditional
func (session *Session) In(column string, args ...any) *Session {
	session.statement.In(column, args...)
	return session
}

// OrIn provides a query string like "id in (1, 2, 3)" using the OR conditional
func (session *Session) OrIn(column string, args ...any) *Session {
	session.statement.OrIn(column, args...)
	return session
}

// NotIn provides a query string like "id in (1, 2, 3)"
func (session *Session) NotIn(column string, args ...any) *Session {
	session.statement.NotIn(column, args...)
	return session
}

// Conds returns session query conditions except auto bean conditions
func (session *Session) Conds() builder.Cond {
	return session.statement.cond
}

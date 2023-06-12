// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"reflect"
)

// IterFunc only use by Iterate
type IterFunc func(idx int, bean interface{}) error

// Rows return sql.Rows compatible Rows obj, as a forward Iterator object for iterating record by record, bean's non-empty fields
// are conditions.
func (session *Session) Rows(bean interface{}) (*Rows, error) {
	return newRows(session, bean)
}

// Iterate record by record handle records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (session *Session) Iterate(bean interface{}, fun IterFunc) error {
	if session.isAutoClose {
		defer session.Close()
	}

	if session.statement.lastError != nil {
		return session.statement.lastError
	}

	if session.statement.bufferSize > 0 {
		return session.bufferIterate(bean, fun)
	}

	rows, err := session.Rows(bean)
	if err != nil {
		return err
	}
	defer rows.Close()

	i := 0
	for rows.Next() {
		b := reflect.New(rows.beanType).Interface()
		err = rows.Scan(b)
		if err != nil {
			return err
		}
		err = fun(i, b)
		if err != nil {
			return err
		}
		i++
	}
	return rows.Err()
}

// BufferSize sets the buffersize for iterate
func (session *Session) BufferSize(size int) *Session {
	session.statement.bufferSize = size
	return session
}

func (session *Session) bufferIterate(bean interface{}, fun IterFunc) error {
	var bufferSize = session.statement.bufferSize
	var pLimitN = session.statement.LimitN
	if pLimitN != nil && bufferSize > *pLimitN {
		bufferSize = *pLimitN
	}
	var start = session.statement.Start
	v := rValue(bean)
	sliceType := reflect.SliceOf(v.Type())
	var idx = 0
	session.autoResetStatement = false
	defer func() {
		session.autoResetStatement = true
	}()

	for bufferSize > 0 {
		slice := reflect.New(sliceType)
		if err := session.NoCache().Limit(bufferSize, start).find(slice.Interface(), bean); err != nil {
			return err
		}

		for i := 0; i < slice.Elem().Len(); i++ {
			if err := fun(idx, slice.Elem().Index(i).Addr().Interface()); err != nil {
				return err
			}
			idx++
		}

		if bufferSize > slice.Elem().Len() {
			break
		}

		start = start + slice.Elem().Len()
		if pLimitN != nil && start+bufferSize > *pLimitN {
			bufferSize = *pLimitN - start
		}
	}

	return nil
}

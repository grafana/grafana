// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
)

var (
	// ErrParamsType params error
	ErrParamsType = errors.New("params type error")
	// ErrTableNotFound table not found error
	ErrTableNotFound = errors.New("table not found")
	// ErrUnSupportedType unsupported error
	ErrUnSupportedType = errors.New("unsupported type error")
	// ErrNotExist record does not exist error
	ErrNotExist = errors.New("record does not exist")
	// ErrCacheFailed cache failed error
	ErrCacheFailed = errors.New("cache failed")
	// ErrNeedDeletedCond delete needs less one condition error
	ErrNeedDeletedCond = errors.New("delete action needs at least one condition")
	// ErrNotImplemented not implemented
	ErrNotImplemented = errors.New("not implemented")
	// ErrConditionType condition type unsupported
	ErrConditionType = errors.New("unsupported condition type")
	// ErrUnSupportedSQLType parameter of SQL is not supported
	ErrUnSupportedSQLType = errors.New("unsupported sql type")
)

// ErrFieldIsNotExist columns does not exist
type ErrFieldIsNotExist struct {
	FieldName string
	TableName string
}

func (e ErrFieldIsNotExist) Error() string {
	return fmt.Sprintf("field %s is not valid on table %s", e.FieldName, e.TableName)
}

// ErrFieldIsNotValid is not valid
type ErrFieldIsNotValid struct {
	FieldName string
	TableName string
}

func (e ErrFieldIsNotValid) Error() string {
	return fmt.Sprintf("field %s is not valid on table %s", e.FieldName, e.TableName)
}

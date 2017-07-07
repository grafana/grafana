// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
)

var (
	ErrParamsType      error = errors.New("Params type error")
	ErrTableNotFound   error = errors.New("Not found table")
	ErrUnSupportedType error = errors.New("Unsupported type error")
	ErrNotExist        error = errors.New("Not exist error")
	ErrCacheFailed     error = errors.New("Cache failed")
	ErrNeedDeletedCond error = errors.New("Delete need at least one condition")
	ErrNotImplemented  error = errors.New("Not implemented.")
)

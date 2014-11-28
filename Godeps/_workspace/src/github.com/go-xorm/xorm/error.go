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

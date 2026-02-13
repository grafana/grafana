package store

import "errors"

var (
	// ErrTupleServiceAddrRequired is returned when storage mode is custom but tuple service address is not set.
	ErrTupleServiceAddrRequired = errors.New("tuple service address is required when storage mode is custom")
	// ErrNotImplemented is returned for store operations that are no longer supported.
	ErrNotImplemented = errors.New("not implemented")
)

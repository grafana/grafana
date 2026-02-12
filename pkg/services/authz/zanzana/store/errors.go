package store

import "errors"

var (
	// ErrTupleServiceAddrRequired is returned when storage mode is custom but tuple service address is not set.
	ErrTupleServiceAddrRequired = errors.New("tuple service address is required when storage mode is custom")
	// ErrStoreIDOrNameRequired is returned when creating a store with empty ID or name.
	ErrStoreIDOrNameRequired = errors.New("store ID and name are required")
)

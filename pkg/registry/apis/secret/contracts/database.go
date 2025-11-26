package contracts

import (
	"context"
	"database/sql"
)

type Database interface {
	DriverName() string
	Transaction(ctx context.Context, f func(context.Context) error) error
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (Rows, error)
}

type Rows interface {
	Close() error
	Next() bool
	Scan(dest ...any) error
	Err() error
}

type StorageBackendType string

const (
	StorageBackendSQL StorageBackendType = "sql"
	StorageBackendKV  StorageBackendType = "kv"
)

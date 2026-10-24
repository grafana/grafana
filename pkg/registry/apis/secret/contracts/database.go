package contracts

import (
	"context"
	"database/sql"
)

type StorageBackendType string

const (
	// The storage type used when Secrets Manager is storing the metadata
	// used for secrets management in the SQL database.
	StorageBackendSQL StorageBackendType = "sql"
	// The storage type used when Secrets Manager is storing the metadata
	// used for secrets management in through the KV api interface.
	StorageBackendKV StorageBackendType = "kv"
)

type Database interface {
	DriverName() string
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (Rows, error)
}

type Rows interface {
	Close() error
	Next() bool
	Scan(dest ...any) error
	Err() error
}

package resource

import (
	"context"
	"database/sql"
)

type transactionContextKey struct{}
type parquetBufferContextKey struct{}

// ContextWithTransaction returns a new context with the transaction stored directly.
// This is used for SQLite migrations where the transaction needs to be shared
// between the migration code and unified storage operations within the same process.
func ContextWithTransaction(ctx context.Context, tx *sql.Tx) context.Context {
	return context.WithValue(ctx, transactionContextKey{}, tx)
}

// TransactionFromContext retrieves the transaction from context
func TransactionFromContext(ctx context.Context) *sql.Tx {
	if v := ctx.Value(transactionContextKey{}); v != nil {
		if tx, ok := v.(*sql.Tx); ok {
			return tx
		}
	}
	return nil
}

// ContextWithParquetBuffer returns a context that signals ProcessBulk to stage
// data through a temporary Parquet file before writing to the database.
func ContextWithParquetBuffer(ctx context.Context) context.Context {
	return context.WithValue(ctx, parquetBufferContextKey{}, true)
}

// ParquetBufferFromContext returns true if the context requests parquet buffering.
func ParquetBufferFromContext(ctx context.Context) bool {
	v, _ := ctx.Value(parquetBufferContextKey{}).(bool)
	return v
}

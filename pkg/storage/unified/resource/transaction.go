package resource

import (
	"context"
	"database/sql"

	"github.com/fullstorydev/grpchan/inprocgrpc"
)

type transactionContextKey struct{}
type parquetBufferContextKey struct{}
type migrationReadContextKey struct{}

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

// ContextWithMigrationRead marks the requests a migration makes after writing, such as the
// validation that builds the search index. The SQL backend runs their listings under the
// migration statement timeout, since its search index build reads a whole index in one
// statement. The KV backend reads keys in short pages, so it does not need to.
func ContextWithMigrationRead(ctx context.Context) context.Context {
	return context.WithValue(ctx, migrationReadContextKey{}, true)
}

// MigrationReadFromContext returns true if the context, or the in-process client context of the
// request it serves, is marked by ContextWithMigrationRead.
func MigrationReadFromContext(ctx context.Context) bool {
	if v, _ := ctx.Value(migrationReadContextKey{}).(bool); v {
		return true
	}
	if clientCtx := inprocgrpc.ClientContext(ctx); clientCtx != nil {
		v, _ := clientCtx.Value(migrationReadContextKey{}).(bool)
		return v
	}
	return false
}

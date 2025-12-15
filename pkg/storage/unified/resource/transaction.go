package resource

import (
	"context"
	"database/sql"
)

type transactionContextKey struct{}

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

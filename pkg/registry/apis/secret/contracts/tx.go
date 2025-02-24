package contracts

import (
	"context"
	"database/sql"
)

type TransactionManager interface {
	BeginTx(ctx context.Context, opts *sql.TxOptions, cb func(*sql.Tx, error))
}

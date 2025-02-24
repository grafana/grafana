package contracts

import (
	"context"
	"database/sql"
)

type TransactionManager interface {
	BeginTx(ctx context.Context, opts *sql.TxOptions, cb func(tx Tx, err error))
}

type Tx interface {
	Commit(func(error))
	Rollback(func(error))
}

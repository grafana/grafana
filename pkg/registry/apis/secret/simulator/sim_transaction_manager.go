package simulator

import (
	"context"
	"database/sql"
)

type SimTransactionManager struct {
	simNetwork *SimNetwork
}

func NewSimTransactionManager(simNetwork *SimNetwork) *SimTransactionManager {
	return &SimTransactionManager{simNetwork}
}

func (tx *SimTransactionManager) BeginTx(ctx context.Context, opts *sql.TxOptions, cb func(*sql.Tx, error)) {
	tx.simNetwork.Send(simDatabaseBeginTxQuery{ctx, opts, cb})
}

package simulator

import (
	"context"
	"database/sql"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type SimTransactionManager struct {
	simNetwork *SimNetwork
}

func NewSimTransactionManager(simNetwork *SimNetwork) *SimTransactionManager {
	return &SimTransactionManager{simNetwork}
}

func (tx *SimTransactionManager) BeginTx(ctx context.Context, opts *sql.TxOptions, cb func(tx contracts.Tx, err error)) {
	tx.simNetwork.Send(simDatabaseBeginTxQuery{ctx, opts, cb})
}

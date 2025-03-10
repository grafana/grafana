package simulator

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/simulator/assert"
)

var transactionContextKey = &struct{}{}

type SimTransactionManager struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabase
}

func NewSimTransactionManager(simNetwork *SimNetwork, simDatabase *SimDatabase) *SimTransactionManager {
	return &SimTransactionManager{simNetwork: simNetwork, simDatabase: simDatabase}
}

func (manager *SimTransactionManager) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	reply := manager.simNetwork.Send(SendInput{
		Debug: "BeginTx",
		Execute: func() any {
			return manager.simDatabase.onQuery(simDatabaseBeginTxQuery{ctx: ctx, opts: nil})
		}}).(simDatabaseBeginTxResponse)

	// If an error happened when starting the transaction
	if reply.err != nil {
		return reply.err
	}
	// Run the function with the transaction in the context
	return fn(context.WithValue(ctx, transactionContextKey, reply.transactionID))
}

func transactionIDFromContext(ctx context.Context) uint64 {
	id := ctx.Value(transactionContextKey).(uint64)
	assert.True(id > 0, "transaction id is not in the context")
	return id
}

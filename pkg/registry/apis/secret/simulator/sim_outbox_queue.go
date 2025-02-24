package simulator

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// Simulation version of contracts.OutboxQueue
type SimOutboxQueue struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabase
}

func NewSimOutboxQueue(simNetwork *SimNetwork) *SimOutboxQueue {
	return &SimOutboxQueue{simNetwork: simNetwork}
}

// Sends a query to the database to append to the outbox queue.
func (queue *SimOutboxQueue) Append(ctx context.Context, tx contracts.TransactionManager, foo any, cb func(error)) {
	queue.simNetwork.Send(simDatabaseAppendQuery{ctx: ctx, tx: tx, foo: foo, cb: cb})
}

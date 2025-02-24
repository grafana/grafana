package simulator

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
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
func (queue *SimOutboxQueue) Append(ctx context.Context, tx contracts.Tx, secureValue *secretv0alpha1.SecureValue, cb func(error)) {
	queue.simNetwork.Send(simDatabaseAppendQuery{ctx: ctx, tx: tx, secureValue: secureValue, cb: cb})
}

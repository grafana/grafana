package simulator

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// Simulation version of contracts.OutboxQueue
type SimOutboxQueue struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabase
}

func NewSimOutboxQueue(simNetwork *SimNetwork, simDatabase *SimDatabase) *SimOutboxQueue {
	return &SimOutboxQueue{simNetwork: simNetwork, simDatabase: simDatabase}
}

// Sends a query to the database to append to the outbox queue.
func (queue *SimOutboxQueue) Append(ctx context.Context, secureValue *secretv0alpha1.SecureValue) error {
	reply := queue.simNetwork.Send(SendInput{
		Debug: "AppendQuery",
		Execute: func() any {
			return queue.simDatabase.onQuery(simDatabaseAppendQuery{ctx: ctx, secureValue: secureValue, transactionID: transactionIDFromContext(ctx)})
		}}).(simDatabaseAppendResponse)

	return reply.err
}

func (queue *SimOutboxQueue) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO")
}

func (queue *SimOutboxQueue) ReceiveN(ctx context.Context, n uint) (messages []contracts.OutboxMessage, err error) {
	panic("TODO")
}

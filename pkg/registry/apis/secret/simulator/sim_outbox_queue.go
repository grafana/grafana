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

func NewSimOutboxQueue(simNetwork *SimNetwork, simDatabase *SimDatabase) *SimOutboxQueue {
	return &SimOutboxQueue{simNetwork: simNetwork, simDatabase: simDatabase}
}

// Sends a query to the database to append to the outbox queue.
func (queue *SimOutboxQueue) Append(ctx context.Context, message contracts.AppendOutboxMessage) error {
	reply := queue.simNetwork.Send(SendInput{
		Debug: "AppendQuery",
		Execute: func() any {
			return queue.simDatabase.onQuery(simDatabaseAppendQuery{message: message, transactionID: transactionIDFromContext(ctx)})
		}}).(simDatabaseAppendResponse)

	return reply.err
}

func (queue *SimOutboxQueue) Delete(ctx context.Context, messageID string) error {
	panic("TODO: Delete")
}

func (queue *SimOutboxQueue) ReceiveN(ctx context.Context, n uint) (messages []contracts.OutboxMessage, err error) {
	reply := queue.simNetwork.Send(SendInput{
		Debug: "AppendQuery",
		Execute: func() any {
			return queue.simDatabase.onQuery(simDatabaseOutboxReceive{n: n})
		}}).(simDatabaseOutboxReceiveResponse)

	return reply.messages, reply.err
}

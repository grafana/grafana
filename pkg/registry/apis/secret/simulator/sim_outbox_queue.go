package simulator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// Simulation version of contracts.OutboxQueue
type SimOutboxQueue struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabaseServer
}

func NewSimOutboxQueue(simNetwork *SimNetwork, simDatabase *SimDatabaseServer) *SimOutboxQueue {
	return &SimOutboxQueue{simNetwork: simNetwork, simDatabase: simDatabase}
}

// Sends a query to the database to append to the outbox queue.
func (queue *SimOutboxQueue) Append(ctx context.Context, message contracts.AppendOutboxMessage) error {
	reply := queue.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("AppendQuery(%+v, %+v)", transactionIDFromContext(ctx), message),
		Execute: func() any {
			return queue.simDatabase.onQuery(simDatabaseAppendQuery{message: message, transactionID: transactionIDFromContext(ctx)})
		}}).(simDatabaseAppendResponse)

	return reply.err
}

func (queue *SimOutboxQueue) Delete(ctx context.Context, messageID string) error {
	reply := queue.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("Outbox.Delete(%+v)", messageID),
		Execute: func() any {
			return queue.simDatabase.onQuery(simDatabaseOutboxDeleteQuery{transactionID: transactionIDFromContext(ctx), messageID: messageID})
		}}).(simDatabaseOutboxDeleteResponse)

	return reply.err
}

func (queue *SimOutboxQueue) ReceiveN(ctx context.Context, n uint) (messages []contracts.OutboxMessage, err error) {
	reply := queue.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("ReceiveN(%+v)", n),
		Execute: func() any {
			return queue.simDatabase.onQuery(simDatabaseOutboxReceive{transactionID: transactionIDFromContext(ctx), n: n})
		}}).(simDatabaseOutboxReceiveResponse)

	return reply.messages, reply.err
}

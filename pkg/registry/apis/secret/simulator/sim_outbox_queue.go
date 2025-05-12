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
func (queue *SimOutboxQueue) Append(ctx context.Context, message contracts.AppendOutboxMessage) (string, error) {
	reply := queue.simNetwork.Send(ctx, SendInput{
		Debug: fmt.Sprintf("AppendQuery(%+v, %+v)", transactionIDFromContext(ctx), message),
		Execute: func() any {
			messageID, err := queue.simDatabase.QueryOutboxAppend(transactionIDFromContext(ctx), message)
			return []any{messageID, err}
		}}).([]any)

	return reply[0].(string), toError(reply[1])
}

func (queue *SimOutboxQueue) Delete(ctx context.Context, messageID string) error {
	reply := queue.simNetwork.Send(ctx, SendInput{
		Debug: fmt.Sprintf("Outbox.Delete(%+v)", messageID),
		Execute: func() any {
			return queue.simDatabase.QueryOutboxDelete(transactionIDFromContext(ctx), messageID)
		}})

	return toError(reply)
}

func (queue *SimOutboxQueue) ReceiveN(ctx context.Context, n uint) ([]contracts.OutboxMessage, error) {
	reply := queue.simNetwork.Send(ctx, SendInput{
		Debug: fmt.Sprintf("ReceiveN(%+v)", n),
		Execute: func() any {
			messages, err := queue.simDatabase.QueryOutboxReceive(transactionIDFromContext(ctx), n)
			return []any{messages, err}
		}}).([]any)

	return reply[0].([]contracts.OutboxMessage), toError(reply[1])
}

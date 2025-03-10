package simulator

import (
	"context"
)

type SimTransactionManager struct {
	simNetwork *SimNetwork
}

func NewSimTransactionManager(simNetwork *SimNetwork) *SimTransactionManager {
	return &SimTransactionManager{simNetwork}
}

func (manager *SimTransactionManager) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	reply := manager.simNetwork.Send(SendInput{
		Debug: "BeginTx",
		Execute: func() any {
			return simDatabaseBeginTxQuery{ctx: ctx, opts: nil}
		}}).(simDatabaseBeginTxResponse)

	// If an error happened when starting the transaction
	if reply.err != nil {
		return reply.err
	}
	// Run the function with the transaction in the context
	// TOOD: add tx to context
	return fn(ctx)
}

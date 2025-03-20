package simulator

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

var transactionContextKey = &struct{}{}

// Implementation of contracts.Database
type SimDatabaseClient struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabaseServer
}

func NewSimDatabaseClient(simNetwork *SimNetwork, simDatabase *SimDatabaseServer) *SimDatabaseClient {
	return &SimDatabaseClient{simNetwork: simNetwork, simDatabase: simDatabase}
}

func (client *SimDatabaseClient) Transaction(ctx context.Context, fn func(ctx context.Context) error) error {
	// Send a request to the database server to start a transaction
	reply := client.simNetwork.Send(SendInput{
		Debug: "BeginTx",
		Execute: func() any {
			return client.simDatabase.onQuery(simDatabaseBeginTxQuery{ctx: ctx, opts: nil})
		}}).(simDatabaseBeginTxResponse)

	// If an error happened when starting the transaction
	if reply.err != nil {
		return reply.err
	}

	// Run the function with the transaction in the context
	if err := fn(context.WithValue(ctx, transactionContextKey, reply.transactionID)); err != nil {
		// If an error happened, rollback the transaction
		rollbackReply := client.simNetwork.Send(SendInput{
			Debug: fmt.Sprintf("RollbackTx(%+v)", reply.transactionID),
			Execute: func() any {
				return client.simDatabase.onQuery(simDatabaseRollback{transactionID: reply.transactionID})
			}}).(simDatabaseRollbackResponse)

		return errors.Join(err, rollbackReply.err)
	}

	commitReply := client.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("CommiTx(%+v)", reply.transactionID),
		Execute: func() any {
			return client.simDatabase.onQuery(simDatabaseCommit{transactionID: reply.transactionID})
		}}).(simDatabaseCommitResponse)

	// If an error happened when committing the transaction
	if commitReply.err != nil {
		return commitReply.err
	}

	return nil
}

func (client *SimDatabaseClient) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	panic("TODO: SimDatabaseClient.ExecContext")
}

func (client *SimDatabaseClient) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	panic("TODO: SimDatabaseClient.QueryContext")
}

func transactionIDFromContext(ctx context.Context) uint64 {
	id, ok := ctx.Value(transactionContextKey).(uint64)
	if !ok {
		return 0
	}

	return id
}

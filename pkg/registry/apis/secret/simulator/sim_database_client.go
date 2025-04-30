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

func (client *SimDatabaseClient) DriverName() string {
	panic("unimplemented")
}

func (client *SimDatabaseClient) Transaction(ctx context.Context, fn func(ctx context.Context) error) error {
	// Send a request to the database server to start a transaction
	reply := client.simNetwork.Send(SendInput{
		Debug: "BeginTx",
		Execute: func() any {
			txID, err := client.simDatabase.QueryBeginTx(ctx)
			return []any{txID, err}
		}}).([]any)
	transactionID := reply[0].(TransactionID)
	err := toError(reply[1])

	// If an error happened when starting the transaction
	if err != nil {
		return err
	}

	// Run the function with the transaction in the context
	if err := fn(context.WithValue(ctx, transactionContextKey, transactionID)); err != nil {
		// If an error happened, rollback the transaction
		rollbackErr := toError(client.simNetwork.Send(SendInput{
			Debug: fmt.Sprintf("RollbackTx(%+v)", transactionID),
			Execute: func() any {
				return client.simDatabase.QueryRollbackTx(transactionID)
			}}))

		return errors.Join(err, rollbackErr)
	}

	commitErr := toError(client.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("CommiTx(%+v)", transactionID),
		Execute: func() any {
			return client.simDatabase.QueryCommitTx(transactionID)
		}}))

	// If an error happened when committing the transaction
	if commitErr != nil {
		return commitErr
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

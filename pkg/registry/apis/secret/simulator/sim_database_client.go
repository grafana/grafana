package simulator

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
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

// Implementation of contracts.Database// contextSessionTxKey is the key used to store the transaction in the context.
type contextSessionTxKey struct{}

// Implements contracts.Database
type SimDatabaseClient2 struct {
	simNetwork *SimNetwork
	dbType     string
	sqlx       *sqlx.DB
}

func NewSimDatabaseClient2(simNetwork *SimNetwork, db *sqlx.DB) *SimDatabaseClient2 {
	return &SimDatabaseClient2{
		simNetwork: simNetwork,
		sqlx:       db,
	}
}

func (db *SimDatabaseClient2) DriverName() string {
	return "mysql"
}

func (db *SimDatabaseClient2) Transaction(ctx context.Context, callback func(context.Context) error) error {
	reply := db.simNetwork.Send(SendInput{
		Debug: "Transaction",
		Execute: func() any {
			txCtx := ctx

			// If another transaction is already open, we just use that one instead of nesting.
			sqlxTx, ok := txCtx.Value(contextSessionTxKey{}).(*sqlx.Tx)
			if sqlxTx != nil && ok {
				// We are already in a transaction, so we don't commit or rollback, let the outermost transaction do it.
				return callback(txCtx)
			}

			tx, err := db.sqlx.Beginx()
			if err != nil {
				return err
			}

			sqlxTx = tx

			// Save it in the context so the transaction can be reused in case it is nested.
			txCtx = context.WithValue(ctx, contextSessionTxKey{}, sqlxTx)

			if err := callback(txCtx); err != nil {
				_ = coro.Yield()
				if rbErr := sqlxTx.Rollback(); rbErr != nil {
					return errors.Join(err, rbErr)
				}

				return err
			}

			_ = coro.Yield()
			return sqlxTx.Commit()
		},
	})

	return toError(reply)
}

func (db *SimDatabaseClient2) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	reply := db.simNetwork.Send(SendInput{
		Debug: "ExecContext",
		Execute: func() any {
			// If another transaction is already open, we just use that one instead of nesting.
			if tx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx); tx != nil && ok {
				result, err := tx.ExecContext(ctx, db.sqlx.Rebind(query), args...)
				return []any{result, err}
			}

			result, err := db.sqlx.ExecContext(ctx, db.sqlx.Rebind(query), args...)
			return []any{result, err}
		},
	}).([]any)
	if reply[0] == nil {
		return nil, toError(reply[1])
	}
	return reply[0].(sql.Result), toError(reply[1])
}

func (db *SimDatabaseClient2) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	reply := db.simNetwork.Send(SendInput{
		Debug: "QueryContext",
		Execute: func() any {
			// If another transaction is already open, we just use that one instead of nesting.
			if tx, ok := ctx.Value(contextSessionTxKey{}).(*sqlx.Tx); tx != nil && ok {
				rows, err := tx.QueryContext(ctx, db.sqlx.Rebind(query), args...)
				return []any{rows, err}
			}

			rows, err := db.sqlx.QueryContext(ctx, db.sqlx.Rebind(query), args...)
			return []any{rows, err}
		},
	}).([]any)
	if reply[0] == nil {
		return nil, toError(reply[1])
	}
	return reply[0].(contracts.Rows), toError(reply[1])

}

package simulator

import (
	"context"
	"database/sql"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// Implementation of contracts.Database
type SimDatabase2 struct {
	simNetwork *SimNetwork
	db         db.DB
}

func NewSimDatabase2(simNetwork *SimNetwork, db db.DB) *SimDatabase2 {
	return &SimDatabase2{simNetwork: simNetwork, db: db}
}

func (client *SimDatabase2) Transaction(ctx context.Context, fn func(ctx context.Context) error) error {
	// Send a request to the database server to start a transaction
	reply := client.simNetwork.Send(ctx, SendInput{
		Debug: "Transaction",
		Execute: func() any {
			return client.db.InTransaction(ctx, fn)
		}})

	return toError(reply)
}

func (client *SimDatabase2) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	panic("TODO: SimDatabase2.ExecContext")
}

func (client *SimDatabase2) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	panic("TODO: SimDatabase2.QueryContext")
}

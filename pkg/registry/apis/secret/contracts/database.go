package contracts

import (
	"context"
	"database/sql"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type Database interface {
	Transaction(ctx context.Context, f func(*session.SessionTx) error) error
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (Rows, error)
}

type Rows interface {
	Close() error
	Next() bool
	Scan(dest ...any) error
}

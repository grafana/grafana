package db

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/jmoiron/sqlx"
)

type DB interface {
	WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	NewSession(ctx context.Context) *sqlstore.DBSession
	GetDialect() migrator.Dialect
	GetDB() *sqlx.DB
	WithTransaction(ctx context.Context, callback func(*sqlx.Tx) error) error
	BuildInsertWithReturningId(query string) (string, bool)
}

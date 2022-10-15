package db

import (
	"context"

	"xorm.io/core"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type DB interface {
	WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithNewDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	GetDialect() migrator.Dialect
	GetDBType() core.DbType
	GetSqlxSession() *session.SessionDB
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

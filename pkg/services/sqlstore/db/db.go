package db

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlxsession"
	"xorm.io/core"
)

type DB interface {
	WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithDbSession(ctx context.Context, callback sqlstore.DBSessionFunc) error
	WithNewDbSession(ctx context.Context, callback sqlstore.DBSessionFunc) error
	GetDialect() migrator.Dialect
	GetDBType() core.DbType
	GetSqlxSession() *sqlxsession.DBSession
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

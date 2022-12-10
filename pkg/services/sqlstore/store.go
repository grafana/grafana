package sqlstore

import (
	"context"

	"xorm.io/core"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type Store interface {
	GetDialect() migrator.Dialect
	GetDBType() core.DbType
	WithDbSession(ctx context.Context, callback DBTransactionFunc) error
	WithNewDbSession(ctx context.Context, callback DBTransactionFunc) error
	WithTransactionalDbSession(ctx context.Context, callback DBTransactionFunc) error
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	Migrate(bool) error
	Sync() error
	Reset() error
	Quote(value string) string
	GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error
	GetSqlxSession() *session.SessionDB
}

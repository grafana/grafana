package sqlstore

import (
	"context"

	"xorm.io/core"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/user"
)

type Store interface {
	GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error
	GetDataSourceStats(ctx context.Context, query *models.GetDataSourceStatsQuery) error
	GetDataSourceAccessStats(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error
	GetDialect() migrator.Dialect
	GetDBType() core.DbType
	GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error
	CreateUser(ctx context.Context, cmd user.CreateUserCommand) (*user.User, error)
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

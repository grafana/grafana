package sqlstore

import (
	"context"

	"xorm.io/core"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/user"
)

type Store interface {
	GetAdminStats(ctx context.Context, query *models.GetAdminStatsQuery) error
	GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error
	GetDataSourceStats(ctx context.Context, query *models.GetDataSourceStatsQuery) error
	GetDataSourceAccessStats(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error
	GetDialect() migrator.Dialect
	GetDBType() core.DbType
	GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error
	CreateUser(ctx context.Context, cmd user.CreateUserCommand) (*user.User, error)
	GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error
	WithDbSession(ctx context.Context, callback DBTransactionFunc) error
	WithNewDbSession(ctx context.Context, callback DBTransactionFunc) error
	GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error
	GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error
	UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error
	GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error
	GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error
	UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error
	GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error
	WithTransactionalDbSession(ctx context.Context, callback DBTransactionFunc) error
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	GetDBEngine() *xorm.Engine
	GetDBConfig() *DatabaseConfig
	Migrate(bool) error
	Sync() error
	Reset() error
	Quote(value string) string
	GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error
	GetSqlxSession() *session.SessionDB
}

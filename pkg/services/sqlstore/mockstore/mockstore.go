package mockstore

import (
	"context"

	"xorm.io/core"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/user"
)

type OrgListResponse []struct {
	OrgId    int64
	Response error
}
type SQLStoreMock struct {
	LastGetAlertsQuery      *models.GetAlertsQuery
	LastLoginAttemptCommand *models.CreateLoginAttemptCommand

	ExpectedUser                   *user.User
	ExpectedTeamsByUser            []*models.TeamDTO
	ExpectedAlert                  *models.Alert
	ExpectedSystemStats            *models.SystemStats
	ExpectedDataSourceStats        []*models.DataSourceStats
	ExpectedDataSourcesAccessStats []*models.DataSourceAccessStats
	ExpectedNotifierUsageStats     []*models.NotifierUsageStats
	ExpectedSignedInUser           *user.SignedInUser
	ExpectedLoginAttempts          int64

	ExpectedError error
}

func NewSQLStoreMock() *SQLStoreMock {
	return &SQLStoreMock{}
}

func (m *SQLStoreMock) GetAdminStats(ctx context.Context, query *models.GetAdminStatsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error {
	query.Result = m.ExpectedNotifierUsageStats
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDataSourceStats(ctx context.Context, query *models.GetDataSourceStatsQuery) error {
	query.Result = m.ExpectedDataSourceStats
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDataSourceAccessStats(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error {
	query.Result = m.ExpectedDataSourcesAccessStats
	return m.ExpectedError
}

func (m *SQLStoreMock) GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error {
	query.Result = m.ExpectedSystemStats
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDialect() migrator.Dialect {
	return nil
}

func (m *SQLStoreMock) GetDBType() core.DbType {
	return ""
}

func (m *SQLStoreMock) CreateUser(ctx context.Context, cmd user.CreateUserCommand) (*user.User, error) {
	return nil, m.ExpectedError
}

func (m *SQLStoreMock) GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error {
	query.Result = m.ExpectedSignedInUser
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateTeam(name string, email string, orgID int64) (models.Team, error) {
	return models.Team{
		Name:  name,
		Email: email,
		OrgId: orgID,
	}, nil
}

func (m *SQLStoreMock) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) WithNewDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDBEngine() *xorm.Engine {
	return nil
}

func (m *SQLStoreMock) Migrate(_ bool) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) Sync() error {
	return m.ExpectedError
}

func (m *SQLStoreMock) Reset() error {
	return m.ExpectedError
}

func (m *SQLStoreMock) Quote(value string) string {
	return ""
}

func (m *SQLStoreMock) GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetSqlxSession() *session.SessionDB {
	return nil
}

func (m *SQLStoreMock) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	m.LastLoginAttemptCommand = cmd
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
	query.Result = m.ExpectedAlert
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserLoginAttemptCount(ctx context.Context, query *models.GetUserLoginAttemptCountQuery) error {
	query.Result = m.ExpectedLoginAttempts
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAllAlertQueryHandler(ctx context.Context, query *models.GetAllAlertsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) HandleAlertsQuery(ctx context.Context, query *models.GetAlertsQuery) error {
	m.LastGetAlertsQuery = query
	return m.ExpectedError
}

func (m *SQLStoreMock) PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
	return m.ExpectedError
}

func (m SQLStoreMock) SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error {
	return m.ExpectedError
}

package mockstore

import (
	"context"

	"xorm.io/core"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type OrgListResponse []struct {
	OrgId    int64
	Response error
}
type SQLStoreMock struct {
	LastGetAlertsQuery *models.GetAlertsQuery

	ExpectedUser                   *user.User
	ExpectedTeamsByUser            []*team.TeamDTO
	ExpectedAlert                  *models.Alert
	ExpectedSystemStats            *stats.SystemStats
	ExpectedDataSourceStats        []*stats.DataSourceStats
	ExpectedDataSourcesAccessStats []*stats.DataSourceAccessStats
	ExpectedNotifierUsageStats     []*stats.NotifierUsageStats
	ExpectedSignedInUser           *user.SignedInUser

	ExpectedError error
}

func NewSQLStoreMock() *SQLStoreMock {
	return &SQLStoreMock{}
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

func (m *SQLStoreMock) GetUserProfile(ctx context.Context, query *user.GetUserProfileQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateTeam(name string, email string, orgID int64) (team.Team, error) {
	return team.Team{
		Name:  name,
		Email: email,
		OrgID: orgID,
	}, nil
}

func (m *SQLStoreMock) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) WithNewDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return m.ExpectedError
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

func (m *SQLStoreMock) GetSqlxSession() *session.SessionDB {
	return nil
}

func (m *SQLStoreMock) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
	query.Result = m.ExpectedAlert
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
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

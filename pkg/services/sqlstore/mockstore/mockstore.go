package mockstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
)

type OrgListResponse []struct {
	OrgId    int64
	Response error
}
type SQLStoreMock struct {
	LastGetAlertsQuery      *models.GetAlertsQuery
	LastLoginAttemptCommand *models.CreateLoginAttemptCommand
	LatestUserId            int64

	ExpectedUser                   *user.User
	ExpectedDatasource             *datasources.DataSource
	ExpectedAlert                  *models.Alert
	ExpectedPluginSetting          *models.PluginSetting
	ExpectedDashboards             []*models.Dashboard
	ExpectedDashboardACLInfoList   []*models.DashboardACLInfoDTO
	ExpectedUserOrgList            []*models.UserOrgDTO
	ExpectedOrgListResponse        OrgListResponse
	ExpectedTeamsByUser            []*models.TeamDTO
	ExpectedSearchOrgList          []*models.OrgDTO
	ExpectedSearchUsers            models.SearchUserQueryResult
	ExpectedDatasources            []*datasources.DataSource
	ExpectedOrg                    *models.Org
	ExpectedSystemStats            *models.SystemStats
	ExpectedDataSourceStats        []*models.DataSourceStats
	ExpectedDataSources            []*datasources.DataSource
	ExpectedDataSourcesAccessStats []*models.DataSourceAccessStats
	ExpectedNotifierUsageStats     []*models.NotifierUsageStats
	ExpectedPersistedDashboards    models.HitList
	ExpectedSignedInUser           *models.SignedInUser
	ExpectedAPIKey                 *models.ApiKey
	ExpectedUserStars              map[int64]bool
	ExpectedLoginAttempts          int64

	ExpectedError            error
	ExpectedSetUsingOrgError error
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

func (m *SQLStoreMock) HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrgById(ctx context.Context, cmd *models.GetOrgByIdQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrgByName(name string) (*models.Org, error) {
	return m.ExpectedOrg, m.ExpectedError
}

func (m *SQLStoreMock) GetOrgByNameHandler(ctx context.Context, query *models.GetOrgByNameQuery) error {
	query.Result = m.ExpectedOrg
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateOrgWithMember(name string, userID int64) (models.Org, error) {
	return *m.ExpectedOrg, nil
}
func (m *SQLStoreMock) CreateOrg(ctx context.Context, cmd *models.CreateOrgCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateOrg(ctx context.Context, cmd *models.UpdateOrgCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error {
	return m.ExpectedError
}

func (m SQLStoreMock) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	m.LastLoginAttemptCommand = cmd
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserLoginAttemptCount(ctx context.Context, query *models.GetUserLoginAttemptCountQuery) error {
	query.Result = m.ExpectedLoginAttempts
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateUser(ctx context.Context, cmd user.CreateUserCommand) (*user.User, error) {
	return nil, m.ExpectedError
}

func (m *SQLStoreMock) GetUserById(ctx context.Context, query *models.GetUserByIdQuery) error {
	query.Result = m.ExpectedUser
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserByLogin(ctx context.Context, query *models.GetUserByLoginQuery) error {
	query.Result = m.ExpectedUser
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserByEmail(ctx context.Context, query *models.GetUserByEmailQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateUser(ctx context.Context, cmd *models.UpdateUserCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) ChangeUserPassword(ctx context.Context, cmd *models.ChangeUserPasswordCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateUserLastSeenAt(ctx context.Context, cmd *models.UpdateUserLastSeenAtCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SetUsingOrg(ctx context.Context, cmd *models.SetUsingOrgCommand) error {
	return m.ExpectedSetUsingOrgError
}

func (m *SQLStoreMock) GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetUserOrgList(ctx context.Context, query *models.GetUserOrgListQuery) error {
	query.Result = m.ExpectedUserOrgList
	return m.ExpectedError
}

func (m *SQLStoreMock) GetSignedInUserWithCacheCtx(ctx context.Context, query *models.GetSignedInUserQuery) error {
	query.Result = m.ExpectedSignedInUser
	return m.ExpectedError
}

func (m *SQLStoreMock) GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error {
	query.Result = m.ExpectedSignedInUser
	return m.ExpectedError
}

func (m *SQLStoreMock) SearchUsers(ctx context.Context, query *models.SearchUsersQuery) error {
	query.Result = m.ExpectedSearchUsers
	return m.ExpectedError
}

func (m *SQLStoreMock) DisableUser(ctx context.Context, cmd *models.DisableUserCommand) error {
	m.LatestUserId = cmd.UserId
	return m.ExpectedError
}

func (m *SQLStoreMock) BatchDisableUsers(ctx context.Context, cmd *models.BatchDisableUsersCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteUser(ctx context.Context, cmd *models.DeleteUserCommand) error {
	m.LatestUserId = cmd.UserId
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateUserPermissions(userID int64, isAdmin bool) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SetUserHelpFlag(ctx context.Context, cmd *models.SetUserHelpFlagCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateTeam(name string, email string, orgID int64) (models.Team, error) {
	return models.Team{
		Name:  name,
		Email: email,
		OrgId: orgID,
	}, nil
}

func (m *SQLStoreMock) UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	query.Result = m.ExpectedTeamsByUser
	return m.ExpectedError
}

func (m *SQLStoreMock) AddTeamMember(userID int64, orgID int64, teamID int64, isExternal bool, permission models.PermissionType) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	return false, nil
}

func (m *SQLStoreMock) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	return m.ExpectedError
}

func (m SQLStoreMock) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error) {
	return nil, m.ExpectedError
}

func (m SQLStoreMock) GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) NewSession(ctx context.Context) *sqlstore.DBSession {
	return nil
}

func (m *SQLStoreMock) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSetting, error) {
	return nil, m.ExpectedError
}

func (m *SQLStoreMock) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	query.Result = m.ExpectedPluginSetting
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
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

func (m SQLStoreMock) GetDashboardACLInfoList(ctx context.Context, query *models.GetDashboardACLInfoListQuery) error {
	query.Result = m.ExpectedDashboardACLInfoList
	return m.ExpectedError
}

func (m *SQLStoreMock) CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdatePlaylist(ctx context.Context, cmd *models.UpdatePlaylistCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetPlaylist(ctx context.Context, query *models.GetPlaylistByUidQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SearchPlaylists(ctx context.Context, query *models.GetPlaylistsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByUidQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
	query.Result = m.ExpectedAlert
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAllAlertQueryHandler(ctx context.Context, query *models.GetAllAlertsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) HandleAlertsQuery(ctx context.Context, query *models.GetAlertsQuery) error {
	m.LastGetAlertsQuery = query
	return m.ExpectedError
}

func (m SQLStoreMock) SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error {
	testData := m.ExpectedOrgListResponse[0]
	m.ExpectedOrgListResponse = m.ExpectedOrgListResponse[1:]
	return testData.Response
}

func (m *SQLStoreMock) GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error {
	return nil // TODO: Implement
}

func (m *SQLStoreMock) GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error {
	query.Result = m.ExpectedDashboards
	return m.ExpectedError
}

func (m SQLStoreMock) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) error {
	query.Result = m.ExpectedDatasource
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) error {
	query.Result = m.ExpectedDataSources
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) error {
	query.Result = m.ExpectedDataSources
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDefaultDataSource(ctx context.Context, query *datasources.GetDefaultDataSourceQuery) error {
	query.Result = m.ExpectedDatasource
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) error {
	cmd.Result = m.ExpectedDatasource
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) error {
	cmd.Result = m.ExpectedDatasource
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

func (m *SQLStoreMock) DeleteAlertNotification(ctx context.Context, cmd *models.DeleteAlertNotificationCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) DeleteAlertNotificationWithUid(ctx context.Context, cmd *models.DeleteAlertNotificationWithUidCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotifications(ctx context.Context, query *models.GetAlertNotificationsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationsWithUid(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAllAlertNotifications(ctx context.Context, query *models.GetAllAlertNotificationsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateAlertNotificationWithUid(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAllAPIKeys(ctx context.Context, orgID int64) []*models.ApiKey {
	return nil
}

func (m *SQLStoreMock) DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error {
	query.Result = m.ExpectedAPIKey
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return nil
}

func (m *SQLStoreMock) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) SearchOrgs(ctx context.Context, query *models.SearchOrgsQuery) error {
	query.Result = m.ExpectedSearchOrgList
	return m.ExpectedError
}

func (m *SQLStoreMock) HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *models.HasAdminPermissionInDashboardsOrFoldersQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error {
	return m.ExpectedError
}

func (m *SQLStoreMock) GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error) {
	return nil, m.ExpectedError
}

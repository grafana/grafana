package mockstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type SQLStoreMock struct {
	SQLStore      *sqlstore.SQLStore
	ExpectedError error
}

func NewSQLStoreMock() *SQLStoreMock {
	return &SQLStoreMock{}
}

func (m SQLStoreMock) DeleteExpiredSnapshots(ctx context.Context, cmd *models.DeleteExpiredSnapshotsCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CreateDashboardSnapshot(ctx context.Context, cmd *models.CreateDashboardSnapshotCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteDashboardSnapshot(ctx context.Context, cmd *models.DeleteDashboardSnapshotCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboardSnapshot(query *models.GetDashboardSnapshotQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SearchDashboardSnapshots(query *models.GetDashboardSnapshotsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetOrgByName(name string) (*models.Org, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) CreateOrgWithMember(name string, userID int64) (models.Org, error) {
	return models.Org{}, nil // TODO: Implement
}

func (m SQLStoreMock) UpdateOrg(ctx context.Context, cmd *models.UpdateOrgCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CloneUserToServiceAccount(ctx context.Context, siUser *models.SignedInUser) (*models.User, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) CreateServiceAccountForApikey(ctx context.Context, orgId int64, keyname string, role models.RoleType) (*models.User, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) CreateUser(ctx context.Context, cmd models.CreateUserCommand) (*models.User, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) GetUserById(ctx context.Context, query *models.GetUserByIdQuery) error {
	return m.ExpectedError
}

func (m SQLStoreMock) GetUserByLogin(ctx context.Context, query *models.GetUserByLoginQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserByEmail(ctx context.Context, query *models.GetUserByEmailQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateUser(ctx context.Context, cmd *models.UpdateUserCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) ChangeUserPassword(ctx context.Context, cmd *models.ChangeUserPasswordCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateUserLastSeenAt(ctx context.Context, cmd *models.UpdateUserLastSeenAtCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SetUsingOrg(ctx context.Context, cmd *models.SetUsingOrgCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserOrgList(ctx context.Context, query *models.GetUserOrgListQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetSignedInUserWithCacheCtx(ctx context.Context, query *models.GetSignedInUserQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) BatchDisableUsers(ctx context.Context, cmd *models.BatchDisableUsersCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteUser(ctx context.Context, cmd *models.DeleteUserCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateUserPermissions(userID int64, isAdmin bool) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SetUserHelpFlag(ctx context.Context, cmd *models.SetUserHelpFlagCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CreateTeam(name string, email string, orgID int64) (models.Team, error) {
	return models.Team{}, nil // TODO: Implement
}

func (m SQLStoreMock) UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) AddTeamMember(userID int64, orgID int64, teamID int64, isExternal bool, permission models.PermissionType) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	return false, nil // TODO: Implement
}

func (m SQLStoreMock) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error) {
	return nil, m.ExpectedError
}

func (m SQLStoreMock) GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) NewSession(ctx context.Context) *sqlstore.DBSession {
	return nil // TODO: Implement
}

func (m SQLStoreMock) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboardVersion(ctx context.Context, query *models.GetDashboardVersionQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboardVersions(ctx context.Context, query *models.GetDashboardVersionsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteExpiredVersions(ctx context.Context, cmd *models.DeleteExpiredVersionsCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateDashboardACL(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateDashboardACLCtx(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdatePlaylist(ctx context.Context, cmd *models.UpdatePlaylistCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetPlaylist(ctx context.Context, query *models.GetPlaylistByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SearchPlaylists(ctx context.Context, query *models.GetPlaylistsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAllAlertQueryHandler(ctx context.Context, query *models.GetAllAlertsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) HandleAlertsQuery(ctx context.Context, query *models.GetAlertsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboard(id int64, orgID int64, uid string, slug string) (*models.Dashboard, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error) {
	return nil, nil // TODO: Implement
}

func (m SQLStoreMock) SearchDashboards(ctx context.Context, query *search.FindPersistedDashboardsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error) {
	return false, nil // TODO: Implement
}

func (m SQLStoreMock) GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) Migrate(_ bool) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) Sync() error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) Reset() error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) Quote(value string) string {
	return "" // TODO: Implement
}

func (m SQLStoreMock) DeleteAlertNotification(ctx context.Context, cmd *models.DeleteAlertNotificationCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteAlertNotificationWithUid(ctx context.Context, cmd *models.DeleteAlertNotificationWithUidCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAlertNotifications(ctx context.Context, query *models.GetAlertNotificationsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAlertNotificationsWithUid(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAllAlertNotifications(ctx context.Context, query *models.GetAllAlertNotificationsQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateAlertNotificationWithUid(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetNonServiceAccountAPIKeys(ctx context.Context) []*models.ApiKey {
	return nil // TODO: Implement
}

func (m SQLStoreMock) DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateApikeyServiceAccount(ctx context.Context, apikeyId int64, saccountId int64) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error {
	return nil // TODO: Implement
}

func (m SQLStoreMock) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	return nil // TODO: Implement
}

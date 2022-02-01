package mockstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type sqlStoreMock struct{}

func (m sqlStoreMock) DeleteExpiredSnapshots(ctx context.Context, cmd *models.DeleteExpiredSnapshotsCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateDashboardSnapshot(ctx context.Context, cmd *models.CreateDashboardSnapshotCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteDashboardSnapshot(ctx context.Context, cmd *models.DeleteDashboardSnapshotCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboardSnapshot(query *models.GetDashboardSnapshotQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SearchDashboardSnapshots(query *models.GetDashboardSnapshotsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetOrgByName(name string) (*models.Org, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateOrgWithMember(name string, userID int64) (models.Org, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateOrg(ctx context.Context, cmd *models.UpdateOrgCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CloneUserToServiceAccount(ctx context.Context, siUser *models.SignedInUser) (*models.User, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateServiceAccountForApikey(ctx context.Context, orgId int64, keyname string, role models.RoleType) (*models.User, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateUser(ctx context.Context, cmd models.CreateUserCommand) (*models.User, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserById(ctx context.Context, query *models.GetUserByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserByLogin(ctx context.Context, query *models.GetUserByLoginQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserByEmail(ctx context.Context, query *models.GetUserByEmailQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateUser(ctx context.Context, cmd *models.UpdateUserCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) ChangeUserPassword(ctx context.Context, cmd *models.ChangeUserPasswordCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateUserLastSeenAt(ctx context.Context, cmd *models.UpdateUserLastSeenAtCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SetUsingOrg(ctx context.Context, cmd *models.SetUsingOrgCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserOrgList(ctx context.Context, query *models.GetUserOrgListQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetSignedInUserWithCacheCtx(ctx context.Context, query *models.GetSignedInUserQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) BatchDisableUsers(ctx context.Context, cmd *models.BatchDisableUsersCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteUser(ctx context.Context, cmd *models.DeleteUserCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateUserPermissions(userID int64, isAdmin bool) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SetUserHelpFlag(ctx context.Context, cmd *models.SetUserHelpFlagCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateTeam(name string, email string, orgID int64) (models.Team, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) AddTeamMember(userID int64, orgID int64, teamID int64, isExternal bool, permission models.PermissionType) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) NewSession(ctx context.Context) *sqlstore.DBSession {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboardVersion(ctx context.Context, query *models.GetDashboardVersionQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboardVersions(ctx context.Context, query *models.GetDashboardVersionsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteExpiredVersions(ctx context.Context, cmd *models.DeleteExpiredVersionsCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateDashboardACL(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateDashboardACLCtx(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdatePlaylist(ctx context.Context, cmd *models.UpdatePlaylistCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetPlaylist(ctx context.Context, query *models.GetPlaylistByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SearchPlaylists(ctx context.Context, query *models.GetPlaylistsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAllAlertQueryHandler(ctx context.Context, query *models.GetAllAlertsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) HandleAlertsQuery(ctx context.Context, query *models.GetAlertsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboard(id int64, orgID int64, uid string, slug string) (*models.Dashboard, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SearchDashboards(ctx context.Context, query *search.FindPersistedDashboardsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error) {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) Migrate() error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) Sync() error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) Reset() error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) Quote(value string) string {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteAlertNotification(ctx context.Context, cmd *models.DeleteAlertNotificationCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteAlertNotificationWithUid(ctx context.Context, cmd *models.DeleteAlertNotificationWithUidCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAlertNotifications(ctx context.Context, query *models.GetAlertNotificationsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAlertNotificationsWithUid(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAllAlertNotifications(ctx context.Context, query *models.GetAllAlertNotificationsQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateAlertNotificationWithUid(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetNonServiceAccountAPIKeys(ctx context.Context) []*models.ApiKey {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateApikeyServiceAccount(ctx context.Context, apikeyId int64, saccountId int64) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error {
	panic("not implemented") // TODO: Implement
}

func (m sqlStoreMock) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	panic("not implemented") // TODO: Implement
}

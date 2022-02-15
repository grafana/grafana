package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

type Store interface {
	GetAdminStats(ctx context.Context, query *models.GetAdminStatsQuery) error
	GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error
	GetDataSourceStats(ctx context.Context, query *models.GetDataSourceStatsQuery) error
	GetDataSourceAccessStats(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error
	GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error
	DeleteExpiredSnapshots(ctx context.Context, cmd *models.DeleteExpiredSnapshotsCommand) error
	CreateDashboardSnapshot(ctx context.Context, cmd *models.CreateDashboardSnapshotCommand) error
	DeleteDashboardSnapshot(ctx context.Context, cmd *models.DeleteDashboardSnapshotCommand) error
	GetDashboardSnapshot(query *models.GetDashboardSnapshotQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error
	SearchDashboardSnapshots(query *models.GetDashboardSnapshotsQuery) error
	GetOrgByName(name string) (*models.Org, error)
	CreateOrgWithMember(name string, userID int64) (models.Org, error)
	UpdateOrg(ctx context.Context, cmd *models.UpdateOrgCommand) error
	UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error
	DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error
	CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error
	DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error
	CloneUserToServiceAccount(ctx context.Context, siUser *models.SignedInUser) (*models.User, error)
	CreateServiceAccountForApikey(ctx context.Context, orgId int64, keyname string, role models.RoleType) (*models.User, error)
	CreateUser(ctx context.Context, cmd models.CreateUserCommand) (*models.User, error)
	GetUserById(ctx context.Context, query *models.GetUserByIdQuery) error
	GetUserByLogin(ctx context.Context, query *models.GetUserByLoginQuery) error
	GetUserByEmail(ctx context.Context, query *models.GetUserByEmailQuery) error
	UpdateUser(ctx context.Context, cmd *models.UpdateUserCommand) error
	ChangeUserPassword(ctx context.Context, cmd *models.ChangeUserPasswordCommand) error
	UpdateUserLastSeenAt(ctx context.Context, cmd *models.UpdateUserLastSeenAtCommand) error
	SetUsingOrg(ctx context.Context, cmd *models.SetUsingOrgCommand) error
	GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error
	GetUserOrgList(ctx context.Context, query *models.GetUserOrgListQuery) error
	GetSignedInUserWithCacheCtx(ctx context.Context, query *models.GetSignedInUserQuery) error
	GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error
	DisableUser(ctx context.Context, cmd *models.DisableUserCommand) error
	BatchDisableUsers(ctx context.Context, cmd *models.BatchDisableUsersCommand) error
	DeleteUser(ctx context.Context, cmd *models.DeleteUserCommand) error
	UpdateUserPermissions(userID int64, isAdmin bool) error
	SetUserHelpFlag(ctx context.Context, cmd *models.SetUserHelpFlagCommand) error
	CreateTeam(name, email string, orgID int64) (models.Team, error)
	UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error
	GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error
	GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error
	AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission models.PermissionType) error
	UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error
	IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error)
	RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error)
	GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error
	NewSession(ctx context.Context) *DBSession
	WithDbSession(ctx context.Context, callback DBTransactionFunc) error
	GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) error
	GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) error
	SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error
	GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error)
	GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error
	UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error
	UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error
	IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error
	StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error
	GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error
	GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error
	GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error
	UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error
	GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error
	GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error
	UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error
	GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error
	WithTransactionalDbSession(ctx context.Context, callback DBTransactionFunc) error
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	GetDashboardVersion(ctx context.Context, query *models.GetDashboardVersionQuery) error
	GetDashboardVersions(ctx context.Context, query *models.GetDashboardVersionsQuery) error
	DeleteExpiredVersions(ctx context.Context, cmd *models.DeleteExpiredVersionsCommand) error
	UpdateDashboardACL(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error
	UpdateDashboardACLCtx(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error
	GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error
	CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error
	UpdatePlaylist(ctx context.Context, cmd *models.UpdatePlaylistCommand) error
	GetPlaylist(ctx context.Context, query *models.GetPlaylistByIdQuery) error
	DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error
	SearchPlaylists(ctx context.Context, query *models.GetPlaylistsQuery) error
	GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByIdQuery) error
	GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error
	GetAllAlertQueryHandler(ctx context.Context, query *models.GetAllAlertsQuery) error
	HandleAlertsQuery(ctx context.Context, query *models.GetAlertsQuery) error
	SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error
	SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error
	PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error
	PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error
	GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error
	AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error
	UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error
	GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error
	SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error
	RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error
	SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error)
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) error
	GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error
	GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error)
	SearchDashboards(ctx context.Context, query *search.FindPersistedDashboardsQuery) error
	DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error
	GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error
	GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error
	ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error)
	GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error
	GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error
	GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error
	GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error
	DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error
	AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error
	UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error
	Migrate() error
	Sync() error
	Reset() error
	Quote(value string) string
	DeleteAlertNotification(ctx context.Context, cmd *models.DeleteAlertNotificationCommand) error
	DeleteAlertNotificationWithUid(ctx context.Context, cmd *models.DeleteAlertNotificationWithUidCommand) error
	GetAlertNotifications(ctx context.Context, query *models.GetAlertNotificationsQuery) error
	GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) error
	GetAlertNotificationsWithUid(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery) error
	GetAllAlertNotifications(ctx context.Context, query *models.GetAllAlertNotificationsQuery) error
	GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error
	CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) error
	UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error
	UpdateAlertNotificationWithUid(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) error
	SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error
	SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error
	GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) error
	GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error
	GetNonServiceAccountAPIKeys(ctx context.Context) []*models.ApiKey
	DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error
	AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error
	UpdateApikeyServiceAccount(ctx context.Context, apikeyId int64, saccountId int64) error
	GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error
	GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error
	UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error
	CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error
	GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error
	GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error
	ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error
	GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error
	SearchOrgs(ctx context.Context, query *models.SearchOrgsQuery) error
}

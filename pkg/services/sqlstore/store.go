package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
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
	GetDashboardSnapshot(ctx context.Context, query *models.GetDashboardSnapshotQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error
	SearchDashboardSnapshots(ctx context.Context, query *models.GetDashboardSnapshotsQuery) error
	GetOrgByName(name string) (*models.Org, error)
	CreateOrg(ctx context.Context, cmd *models.CreateOrgCommand) error
	CreateOrgWithMember(name string, userID int64) (models.Org, error)
	UpdateOrg(ctx context.Context, cmd *models.UpdateOrgCommand) error
	UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error
	DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error
	GetOrgById(context.Context, *models.GetOrgByIdQuery) error
	GetOrgByNameHandler(ctx context.Context, query *models.GetOrgByNameQuery) error
	CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error
	GetUserLoginAttemptCount(ctx context.Context, query *models.GetUserLoginAttemptCountQuery) error
	DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error
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
	SearchUsers(ctx context.Context, query *models.SearchUsersQuery) error
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
	GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSetting, error)
	GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error
	UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error
	UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error
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
	SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error
	PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error
	PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error
	GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error
	AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error
	UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error
	GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error
	SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error
	RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error
	GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error
	SearchDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) error
	GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error
	GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error
	GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error
	GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error
	DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error
	AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error
	UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error
	Migrate(bool) error
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
	GetAllOrgsAPIKeys(ctx context.Context) []*models.ApiKey
	DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error
	AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error
	GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error
	GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error
	GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error)
	UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error
	CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error
	GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error
	GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error
	ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error
	GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error
	SearchOrgs(ctx context.Context, query *models.SearchOrgsQuery) error
	HasAdminPermissionInFolders(ctx context.Context, query *models.HasAdminPermissionInFoldersQuery) error
	GetDashboardPermissionsForUser(ctx context.Context, query *models.GetDashboardPermissionsForUserQuery) error
	IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error
}

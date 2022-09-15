package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/user"
)

var timeNow = time.Now

type Store interface {
	GetAdminStats(ctx context.Context, query *models.GetAdminStatsQuery) error
	GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error
	GetDataSourceStats(ctx context.Context, query *models.GetDataSourceStatsQuery) error
	GetDataSourceAccessStats(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error
	GetDialect() migrator.Dialect
	GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error
	GetOrgByName(name string) (*models.Org, error)
	CreateOrg(ctx context.Context, cmd *models.CreateOrgCommand) error
	CreateOrgWithMember(name string, userID int64) (models.Org, error)
	UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error
	DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error
	GetOrgById(context.Context, *models.GetOrgByIdQuery) error
	GetOrgByNameHandler(ctx context.Context, query *models.GetOrgByNameQuery) error
	CreateUser(ctx context.Context, cmd user.CreateUserCommand) (*user.User, error)
	SetUsingOrg(ctx context.Context, cmd *models.SetUsingOrgCommand) error
	GetUserProfile(ctx context.Context, query *models.GetUserProfileQuery) error
	GetUserOrgList(ctx context.Context, query *models.GetUserOrgListQuery) error
	GetSignedInUser(ctx context.Context, query *models.GetSignedInUserQuery) error
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
	GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error
	GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error
	UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error
	GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error
	GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error
	UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error
	GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error
	WithTransactionalDbSession(ctx context.Context, callback DBTransactionFunc) error
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AddOrgUser(ctx context.Context, cmd *models.AddOrgUserCommand) error
	UpdateOrgUser(ctx context.Context, cmd *models.UpdateOrgUserCommand) error
	GetOrgUsers(ctx context.Context, query *models.GetOrgUsersQuery) error
	SearchOrgUsers(ctx context.Context, query *models.SearchOrgUsersQuery) error
	RemoveOrgUser(ctx context.Context, cmd *models.RemoveOrgUserCommand) error
	Migrate(bool) error
	Sync() error
	Reset() error
	Quote(value string) string
	UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error
	CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error
	GetTempUsersQuery(ctx context.Context, query *models.GetTempUsersQuery) error
	GetTempUserByCode(ctx context.Context, query *models.GetTempUserByCodeQuery) error
	ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error
	GetDBHealthQuery(ctx context.Context, query *models.GetDBHealthQuery) error
	SearchOrgs(ctx context.Context, query *models.SearchOrgsQuery) error
	IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error
	GetSqlxSession() *session.SessionDB
}

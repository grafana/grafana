package test

import (
	"fmt"
	"testing"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type rawPermission struct {
	Action, Scope string
}

func (rp *rawPermission) toPermission(roleID int64, ts time.Time) accesscontrol.Permission {
	return accesscontrol.Permission{
		RoleID:  roleID,
		Action:  rp.Action,
		Scope:   rp.Scope,
		Updated: ts,
		Created: ts,
	}
}

// Setup users
var (
	now = time.Now()

	users = []models.User{
		{
			Id:      1,
			Email:   "viewer1@example.org",
			Name:    "viewer1",
			Login:   "viewer1",
			OrgId:   1,
			Created: now,
			Updated: now,
		},
		{
			Id:      2,
			Email:   "viewer2@example.org",
			Name:    "viewer2",
			Login:   "viewer2",
			OrgId:   1,
			Created: now,
			Updated: now,
		},
		{
			Id:      3,
			Email:   "editor1@example.org",
			Name:    "editor1",
			Login:   "editor1",
			OrgId:   1,
			Created: now,
			Updated: now,
		},
		{
			Id:      4,
			Email:   "admin1@example.org",
			Name:    "admin1",
			Login:   "admin1",
			OrgId:   1,
			Created: now,
			Updated: now,
		},
		{
			Id:      5,
			Email:   "editor2@example.org",
			Name:    "editor2",
			Login:   "editor2",
			OrgId:   2,
			Created: now,
			Updated: now,
		},
	}
)

func convertToRawPermissions(permissions []accesscontrol.Permission) []rawPermission {
	raw := make([]rawPermission, len(permissions))
	for i, p := range permissions {
		raw[i] = rawPermission{Action: p.Action, Scope: p.Scope}
	}
	return raw
}

func TestMigrations(t *testing.T) {
	// Run initial migration to have a working DB
	x := setupTestDB(t)

	// Populate users and teams
	setupTeams(t, x)

	// Create managed user roles with teams permissions (ex: teams:read and teams.permissions:read)
	setupUnecessaryRBACPermissions(t, x)

	team1Scope := accesscontrol.Scope("teams", "id", "1")
	team2Scope := accesscontrol.Scope("teams", "id", "2")

	type teamMigrationTestCase struct {
		desc              string
		config            *setting.Cfg
		expectedRolePerms map[string][]rawPermission
	}
	testCases := []teamMigrationTestCase{
		{
			desc: "with editors can admin",
			config: &setting.Cfg{
				EditorsCanAdmin:        true,
				IsFeatureToggleEnabled: func(key string) bool { return key == "accesscontrol" },
			},
			expectedRolePerms: map[string][]rawPermission{
				"managed:users:1:permissions": {{Action: "teams:read", Scope: team1Scope}},
				"managed:users:2:permissions": {{Action: "teams:read", Scope: team1Scope}},
				"managed:users:3:permissions": {
					{Action: "teams:read", Scope: team1Scope},
					{Action: "teams:delete", Scope: team1Scope},
					{Action: "teams:write", Scope: team1Scope},
					{Action: "teams.permissions:read", Scope: team1Scope},
					{Action: "teams.permissions:write", Scope: team1Scope},
				},
				"managed:users:4:permissions": {
					{Action: "teams:read", Scope: team1Scope},
					{Action: "teams:delete", Scope: team1Scope},
					{Action: "teams:write", Scope: team1Scope},
					{Action: "teams.permissions:read", Scope: team1Scope},
					{Action: "teams.permissions:write", Scope: team1Scope},
				},
				"managed:users:5:permissions": {
					{Action: "teams:read", Scope: team2Scope},
					{Action: "users:read", Scope: "users:*"},
				},
			},
		},
		{
			desc: "without editors can admin",
			config: &setting.Cfg{
				IsFeatureToggleEnabled: func(key string) bool { return key == "accesscontrol" },
			},
			expectedRolePerms: map[string][]rawPermission{
				"managed:users:1:permissions": {{Action: "teams:read", Scope: team1Scope}},
				"managed:users:2:permissions": {{Action: "teams:read", Scope: team1Scope}},
				"managed:users:3:permissions": {{Action: "teams:read", Scope: team1Scope}},
				"managed:users:4:permissions": {
					{Action: "teams:read", Scope: team1Scope},
					{Action: "teams:delete", Scope: team1Scope},
					{Action: "teams:write", Scope: team1Scope},
					{Action: "teams.permissions:read", Scope: team1Scope},
					{Action: "teams.permissions:write", Scope: team1Scope},
				},
				"managed:users:5:permissions": {
					{Action: "teams:read", Scope: team2Scope},
					{Action: "users:read", Scope: "users:*"},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration
			_, errDeleteMig := x.Exec("DELETE FROM migration_log WHERE migration_id = ?", acmig.TeamsMigrationID)
			require.NoError(t, errDeleteMig)

			// Run accesscontrol migration (permissions insertion should not have conflicted)
			acmigrator := migrator.NewMigrator(x, tc.config)
			acmig.AddTeamMembershipMigrations(acmigrator)

			errRunningMig := acmigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			for _, user := range users {
				// Check managed roles exist
				roleName := fmt.Sprintf("managed:users:%d:permissions", user.Id)
				role := accesscontrol.Role{}
				hasRole, errManagedRoleSearch := x.Table("role").Where("org_id = ? AND name = ?", user.OrgId, roleName).Get(&role)

				require.NoError(t, errManagedRoleSearch)
				assert.True(t, hasRole, "expected role to be granted to user", user, roleName)

				// Check permissions associated with each role
				perms := []accesscontrol.Permission{}
				countUserPermissions, errManagedPermsSearch := x.Table("permission").Where("role_id = ?", role.ID).FindAndCount(&perms)

				require.NoError(t, errManagedPermsSearch)
				assert.Equal(t, int64(len(tc.expectedRolePerms[roleName])), countUserPermissions, "expected role to be tied to permissions", user, role)

				rawPerms := convertToRawPermissions(perms)
				for _, perm := range rawPerms {
					assert.Contains(t, tc.expectedRolePerms[roleName], perm)
				}

				// Check assignment of the roles
				assign := accesscontrol.UserRole{}
				has, errAssignmentSearch := x.Table("user_role").Where("role_id = ? AND user_id = ?", role.ID, user.Id).Get(&assign)
				require.NoError(t, errAssignmentSearch)
				assert.True(t, has, "expected assignment of role to user", role, user)
			}
		})
	}
}

func setupTestDB(t *testing.T) *xorm.Engine {
	t.Helper()
	testDB := sqlutil.SQLite3TestDB()

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	err = migrator.NewDialect(x).CleanDB()
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("acmigration.test")})
	migrations := &migrations.OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x
}

func setupTeams(t *testing.T, x *xorm.Engine) {
	t.Helper()

	usersCount, errInsertUsers := x.Insert(users)
	require.NoError(t, errInsertUsers)
	require.Equal(t, int64(5), usersCount, "needed 5 users for this test to run")

	orgUsers := []models.OrgUser{
		{
			OrgId:   1,
			UserId:  1,
			Role:    models.ROLE_VIEWER,
			Created: now,
			Updated: now,
		},
		{
			OrgId:   1,
			UserId:  2,
			Role:    models.ROLE_VIEWER,
			Created: now,
			Updated: now,
		},
		{
			OrgId:   1,
			UserId:  3,
			Role:    models.ROLE_EDITOR,
			Created: now,
			Updated: now,
		},
		{
			OrgId:   1,
			UserId:  4,
			Role:    models.ROLE_ADMIN,
			Created: now,
			Updated: now,
		},
		{
			OrgId:   2,
			UserId:  5,
			Role:    models.ROLE_EDITOR,
			Created: now,
			Updated: now,
		},
	}
	orgUsersCount, errInsertOrgUsers := x.Insert(orgUsers)
	require.NoError(t, errInsertOrgUsers)
	require.Equal(t, int64(5), orgUsersCount, "needed 5 users for this test to run")

	// Setup teams (and members)
	teams := []models.Team{
		{
			OrgId:   1,
			Name:    "teamOrg1",
			Email:   "teamorg1@example.org",
			Created: now,
			Updated: now,
		},
		{
			OrgId:   2,
			Name:    "teamOrg2",
			Email:   "teamorg2@example.org",
			Created: now,
			Updated: now,
		},
	}
	teamCount, errInsertTeams := x.Insert(teams)
	require.NoError(t, errInsertTeams)
	require.Equal(t, int64(2), teamCount, "needed 2 teams for this test to run")

	members := []models.TeamMember{
		{
			// Can have viewer permissions
			OrgId:      1,
			TeamId:     1,
			UserId:     1,
			External:   false,
			Permission: 0,
			Created:    now,
			Updated:    now,
		},
		{
			// Cannot have admin permissions
			OrgId:      1,
			TeamId:     1,
			UserId:     2,
			External:   false,
			Permission: models.PERMISSION_ADMIN,
			Created:    now,
			Updated:    now,
		},
		{
			// Can have admin permissions
			OrgId:      1,
			TeamId:     1,
			UserId:     3,
			External:   false,
			Permission: models.PERMISSION_ADMIN,
			Created:    now,
			Updated:    now,
		},
		{
			// Can have admin permissions
			OrgId:      1,
			TeamId:     1,
			UserId:     4,
			External:   false,
			Permission: models.PERMISSION_ADMIN,
			Created:    now,
			Updated:    now,
		},
		{
			// Can have viewer permissions
			OrgId:      2,
			TeamId:     2,
			UserId:     5,
			External:   false,
			Permission: 0,
			Created:    now,
			Updated:    now,
		},
	}
	membersCount, err := x.Insert(members)
	require.NoError(t, err)
	require.Equal(t, int64(5), membersCount, "needed 5 members for this test to run")
}

func setupUnecessaryRBACPermissions(t *testing.T, x *xorm.Engine) {
	t.Helper()

	now := time.Now()

	role := accesscontrol.Role{
		// ID:      1, Not specifying this for pgsql to correctly increment sequence
		OrgID:   2,
		Version: 1,
		UID:     "user5managedpermissions",
		Name:    "managed:users:5:permissions",
		Updated: now,
		Created: now,
	}
	rolesCount, err := x.Insert(role)
	require.NoError(t, err)
	require.Equal(t, int64(1), rolesCount, "needed 1 role for this test to run")

	userRole := accesscontrol.UserRole{
		OrgID:   2,
		RoleID:  1,
		UserID:  5,
		Created: now,
	}
	userRoleCount, err := x.Insert(userRole)
	require.NoError(t, err)
	require.Equal(t, int64(1), userRoleCount, "needed 1 assignment for this test to run")

	permissions := []accesscontrol.Permission{
		{
			// Permission that shouldn't be removed
			RoleID:  1,
			Action:  "users:read",
			Scope:   "users:*",
			Updated: now,
			Created: now,
		},
		{
			// Permission that should be recreated
			RoleID:  1,
			Action:  "teams:read",
			Scope:   "teams:*",
			Updated: now,
			Created: now,
		},
		{
			// Permission that should be removed
			RoleID:  1,
			Action:  "teams.permissions:read",
			Scope:   "teams:*",
			Updated: now,
			Created: now,
		},
	}
	permissionsCount, err := x.Insert(permissions)
	require.NoError(t, err)
	require.Equal(t, int64(3), permissionsCount, "needed 3 permissions for this test to run")
}

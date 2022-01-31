package test

import (
	"fmt"
	"testing"
	"time"

	"xorm.io/xorm"

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

// Setup users
var (
	now   = time.Now()
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

func TestMigrations(t *testing.T) {
	testDB := sqlutil.SQLite3TestDB()

	const query = `select count(*) as count from migration_log`
	result := struct{ Count int }{}

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	err = migrator.NewDialect(x).CleanDB()
	require.NoError(t, err)

	_, err = x.SQL(query).Get(&result)
	require.Error(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{
		FeatureToggles: map[string]bool{"accesscontrol": true},
	})
	migrations := &migrations.OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start()
	require.NoError(t, err)

	setupTeams(t, x)

	// Create managed user roles with teams permissions (ex: teams:read and teams.permissions:read)
	setupUnecessaryFGACPermissions(t, x)

	// Remove migration
	_, err = x.Exec("DELETE FROM migration_log WHERE migration_id = ?", acmig.TeamsMigrationID)
	require.NoError(t, err)

	// Run accesscontrol migration (permissions insertion should not have conflicted)
	acmigrator := migrator.NewMigrator(x, &setting.Cfg{
		FeatureToggles: map[string]bool{"accesscontrol": true},
	})
	acmig.AddTeamMembershipMigrations(acmigrator)

	err = acmigrator.Start()
	require.NoError(t, err)

	for _, user := range users {
		// Check managed roles exist
		count, err := x.Table("role").Where("org_id = ? AND name = ?", user.OrgId, fmt.Sprintf("managed:users:%d:permissions", user.Id)).Count()

		require.NoError(t, err)
		assert.Equal(t, int64(1), count, user)

		// Check permissions associated with each role

		// Check permissions

		// Check assignment of the roles
	}

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

func setupUnecessaryFGACPermissions(t *testing.T, x *xorm.Engine) {
	t.Helper()

	now := time.Now()

	role := accesscontrol.Role{
		ID:      1,
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
			// Permission that should be removed
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

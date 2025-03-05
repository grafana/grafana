package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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

	users = []user.User{
		{
			ID:      1,
			UID:     "u1",
			Email:   "viewer1@example.org",
			Name:    "viewer1",
			Login:   "viewer1",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      2,
			UID:     "u2",
			Email:   "viewer2@example.org",
			Name:    "viewer2",
			Login:   "viewer2",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      3,
			UID:     "u3",
			Email:   "editor1@example.org",
			Name:    "editor1",
			Login:   "editor1",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      4,
			UID:     "u4",
			Email:   "admin1@example.org",
			Name:    "admin1",
			Login:   "admin1",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      5,
			UID:     "u5",
			Email:   "editor2@example.org",
			Name:    "editor2",
			Login:   "editor2",
			OrgID:   2,
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

func setupTestDB(t *testing.T) *xorm.Engine {
	t.Helper()
	dbType := sqlutil.GetTestDBType()
	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			fmt.Printf("failed to close xorm engine: %v", err)
		}
	})

	err = migrator.NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{
		Logger: log.New("acmigration.test"),
		Raw:    ini.Empty(),
	})
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

	orgUsers := []org.OrgUser{
		{
			OrgID:   1,
			UserID:  1,
			Role:    org.RoleViewer,
			Created: now,
			Updated: now,
		},
		{
			OrgID:   1,
			UserID:  2,
			Role:    org.RoleViewer,
			Created: now,
			Updated: now,
		},
		{
			OrgID:   1,
			UserID:  3,
			Role:    org.RoleEditor,
			Created: now,
			Updated: now,
		},
		{
			OrgID:   1,
			UserID:  4,
			Role:    org.RoleAdmin,
			Created: now,
			Updated: now,
		},
		{
			OrgID:   2,
			UserID:  5,
			Role:    org.RoleEditor,
			Created: now,
			Updated: now,
		},
	}
	orgUsersCount, errInsertOrgUsers := x.Insert(orgUsers)
	require.NoError(t, errInsertOrgUsers)
	require.Equal(t, int64(5), orgUsersCount, "needed 5 users for this test to run")

	// Setup teams (and members)
	teams := []team.Team{
		{
			OrgID:   1,
			Name:    "teamOrg1",
			Email:   "teamorg1@example.org",
			Created: now,
			Updated: now,
		},
		{
			OrgID:   2,
			Name:    "teamOrg2",
			Email:   "teamorg2@example.org",
			Created: now,
			Updated: now,
		},
	}
	teamCount, errInsertTeams := x.Insert(teams)
	require.NoError(t, errInsertTeams)
	require.Equal(t, int64(2), teamCount, "needed 2 teams for this test to run")

	members := []team.TeamMember{
		{
			// Can have viewer permissions
			OrgID:      1,
			TeamID:     1,
			UserID:     1,
			External:   false,
			Permission: team.PermissionTypeMember,
			Created:    now,
			Updated:    now,
		},
		{
			// Cannot have admin permissions
			OrgID:      1,
			TeamID:     1,
			UserID:     2,
			External:   false,
			Permission: team.PermissionTypeAdmin,
			Created:    now,
			Updated:    now,
		},
		{
			// Can have admin permissions
			OrgID:      1,
			TeamID:     1,
			UserID:     3,
			External:   false,
			Permission: team.PermissionTypeAdmin,
			Created:    now,
			Updated:    now,
		},
		{
			// Can have admin permissions
			OrgID:      1,
			TeamID:     1,
			UserID:     4,
			External:   false,
			Permission: team.PermissionTypeAdmin,
			Created:    now,
			Updated:    now,
		},
		{
			// Can have viewer permissions
			OrgID:      2,
			TeamID:     2,
			UserID:     5,
			External:   false,
			Permission: team.PermissionTypeMember,
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

package test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestScopeMigration(t *testing.T) {
	// Run initial migration to have a working DB
	x := setupTestDB(t)

	type migrationTestCase struct {
		desc            string
		permissionSeed  []*accesscontrol.Permission
		wantPermissions []*accesscontrol.Permission
	}
	testCases := []migrationTestCase{
		{
			desc:            "empty perms",
			permissionSeed:  []*accesscontrol.Permission{},
			wantPermissions: []*accesscontrol.Permission{},
		},
		{
			desc: "no permissions with alerting instance read action",
			permissionSeed: []*accesscontrol.Permission{
				{
					RoleID:    1,
					Action:    accesscontrol.ActionAlertingInstancesExternalRead,
					Scope:     datasources.ScopeAll,
					Kind:      "datasources",
					Attribute: "*",
					Created:   now,
					Updated:   now,
				},
			},
			wantPermissions: []*accesscontrol.Permission{
				{
					RoleID:    1,
					Action:    accesscontrol.ActionAlertingInstancesExternalRead,
					Scope:     datasources.ScopeAll,
					Kind:      "datasources",
					Attribute: "*",
				},
			},
		},
		{
			desc: "has permission with alerting instance read action and folder scope",
			permissionSeed: []*accesscontrol.Permission{
				{
					RoleID:     1,
					Action:     accesscontrol.ActionAlertingInstanceRead,
					Scope:      dashboards.ScopeFoldersAll,
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "*",
					Created:    now,
					Updated:    now,
				},
			},
			wantPermissions: []*accesscontrol.Permission{
				{
					RoleID: 1,
					Action: accesscontrol.ActionAlertingInstanceRead,
				},
			},
		},
		{
			desc: "has permission with alerting instance read action and no scope",
			permissionSeed: []*accesscontrol.Permission{
				{
					RoleID:  1,
					Action:  accesscontrol.ActionAlertingInstanceRead,
					Created: now,
					Updated: now,
				},
			},
			wantPermissions: []*accesscontrol.Permission{
				{
					RoleID: 1,
					Action: accesscontrol.ActionAlertingInstanceRead,
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration and permissions
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, acmig.AlertingScopeRemovalMigrationID)
			require.NoError(t, errDeleteMig)
			_, errDeletePerms := x.Exec(`DELETE FROM permission`)
			require.NoError(t, errDeletePerms)

			// seed DB with permissions
			if len(tc.permissionSeed) != 0 {
				permissionsCount, err := x.Insert(tc.permissionSeed)
				require.NoError(t, err)
				require.Equal(t, int64(len(tc.permissionSeed)), permissionsCount)
			}

			// Run RBAC action name migration
			acmigrator := migrator.NewMigrator(x, setting.ProvideService(&setting.Cfg{Logger: log.New("acmigration.test")}))
			acmig.AddAlertingScopeRemovalMigration(acmigrator)

			errRunningMig := acmigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			// Check permissions
			resultingPermissions := []accesscontrol.Permission{}
			err := x.Table("permission").Find(&resultingPermissions)
			require.NoError(t, err)

			// verify got == want
			assert.Equal(t, len(tc.wantPermissions), len(resultingPermissions))
			for _, wantPermission := range tc.wantPermissions {
				foundMatch := false
				for _, resultingPermission := range resultingPermissions {
					if wantPermission.Action == resultingPermission.Action &&
						wantPermission.Scope == resultingPermission.Scope &&
						wantPermission.Kind == resultingPermission.Kind &&
						wantPermission.Attribute == resultingPermission.Attribute &&
						wantPermission.Identifier == resultingPermission.Identifier &&
						wantPermission.RoleID == resultingPermission.RoleID {
						assert.NotEmpty(t, resultingPermission.Updated)
						assert.NotEmpty(t, resultingPermission.Created)
						foundMatch = true
						continue
					}
				}
				assert.True(t, foundMatch, fmt.Sprintf("there should be a permission with action %s in the DB after the migration", wantPermission.Action))
			}
		})
	}
}

package test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationScopeMigration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	x := setupTestDB(t)
	now := time.Now()

	// Vendored.
	actionAlertingReceiversRead := "alert.notifications.receivers:read"
	actionAlertingReceiversReadSecrets := "alert.notifications.receivers.secrets:read"

	type migrationTestCase struct {
		desc            string
		permissionSeed  []*accesscontrol.Permission
		wantPermissions []*accesscontrol.Permission
	}
	testCases := []migrationTestCase{
		{
			desc: "convert existing alert.notifications.receivers:read regardless of scope",
			permissionSeed: []*accesscontrol.Permission{
				{
					RoleID:    1,
					Action:    actionAlertingReceiversRead,
					Scope:     "",
					Kind:      "",
					Attribute: "",
					Created:   now,
					Updated:   now,
				},
				{
					RoleID:    2,
					Action:    actionAlertingReceiversRead,
					Scope:     "Scope",
					Kind:      "Kind",
					Attribute: "Attribute",
					Created:   now,
					Updated:   now,
				},
			},
			wantPermissions: []*accesscontrol.Permission{
				{
					RoleID:     1,
					Action:     actionAlertingReceiversRead,
					Scope:      "receivers:*",
					Kind:       "receivers",
					Attribute:  "*",
					Identifier: "*",
				},
				{
					RoleID:     2,
					Action:     actionAlertingReceiversRead,
					Scope:      "receivers:*",
					Kind:       "receivers",
					Attribute:  "*",
					Identifier: "*",
				},
			},
		},
		{
			desc: "convert existing alert.notifications.receivers:read regardless of scope",
			permissionSeed: []*accesscontrol.Permission{
				{
					RoleID:    1,
					Action:    actionAlertingReceiversReadSecrets,
					Scope:     "",
					Kind:      "",
					Attribute: "",
					Created:   now,
					Updated:   now,
				},
				{
					RoleID:    2,
					Action:    actionAlertingReceiversReadSecrets,
					Scope:     "Scope",
					Kind:      "Kind",
					Attribute: "Attribute",
					Created:   now,
					Updated:   now,
				},
			},
			wantPermissions: []*accesscontrol.Permission{
				{
					RoleID:     1,
					Action:     actionAlertingReceiversReadSecrets,
					Scope:      "receivers:*",
					Kind:       "receivers",
					Attribute:  "*",
					Identifier: "*",
				},
				{
					RoleID:     2,
					Action:     actionAlertingReceiversReadSecrets,
					Scope:      "receivers:*",
					Kind:       "receivers",
					Attribute:  "*",
					Identifier: "*",
				},
			},
		},
		{
			desc:            "empty perms",
			permissionSeed:  []*accesscontrol.Permission{},
			wantPermissions: []*accesscontrol.Permission{},
		},
		{
			desc: "unrelated perms",
			permissionSeed: []*accesscontrol.Permission{
				{
					RoleID:    1,
					Action:    "some.other.resource:read",
					Scope:     "Scope",
					Kind:      "Kind",
					Attribute: "Attribute",
					Created:   now,
					Updated:   now,
				},
			},
			wantPermissions: []*accesscontrol.Permission{
				{
					RoleID:    1,
					Action:    "some.other.resource:read",
					Scope:     "Scope",
					Kind:      "Kind",
					Attribute: "Attribute",
					Created:   now,
					Updated:   now,
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration and permissions
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, ualert.AlertingAddReceiverActionScopes)
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
			acmigrator := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("acmigration.test")})
			ualert.AddReceiverActionScopesMigration(acmigrator)

			errRunningMig := acmigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			// Check permissions
			resultingPermissions := []*accesscontrol.Permission{}
			err := x.Table("permission").Find(&resultingPermissions)
			require.NoError(t, err)

			// verify got == want
			cOpt := []cmp.Option{
				cmpopts.SortSlices(func(a, b accesscontrol.Permission) bool { return a.RoleID < b.RoleID }),
				cmpopts.IgnoreFields(accesscontrol.Permission{}, "ID", "Created", "Updated"),
			}
			if !cmp.Equal(tc.wantPermissions, resultingPermissions, cOpt...) {
				t.Errorf("Unexpected permissions: %v", cmp.Diff(tc.wantPermissions, resultingPermissions, cOpt...))
			}
		})
	}
}

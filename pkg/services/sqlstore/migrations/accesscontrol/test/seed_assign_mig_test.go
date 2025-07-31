package test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPreventOnCallAccessSeed(t *testing.T) {
	// Run initial migration to have a working DB
	x := setupTestDB(t)

	type SeedAssignment struct {
		BuiltinRole, Action, Scope, Origin string
	}

	want := []SeedAssignment{
		{BuiltinRole: "Admin", Action: "plugins.app:access", Scope: "plugins:id:grafana-oncall-app", Origin: "grafana-oncall-app"},
		{BuiltinRole: "Editor", Action: "plugins.app:access", Scope: "plugins:id:grafana-oncall-app", Origin: "grafana-oncall-app"},
		{BuiltinRole: "Viewer", Action: "plugins.app:access", Scope: "plugins:id:grafana-oncall-app", Origin: "grafana-oncall-app"},
		{BuiltinRole: "Grafana Admin", Action: "plugins.app:access", Scope: "plugins:id:grafana-oncall-app", Origin: "grafana-oncall-app"},
	}

	type testCase struct {
		desc string
		init []SeedAssignment
		want []SeedAssignment
	}
	tt := []testCase{
		{
			desc: "fresh table skip migration",
			want: []SeedAssignment{},
		},
		{
			desc: "seeded with an OnCall access already",
			init: []SeedAssignment{
				{BuiltinRole: "Admin", Action: "plugins.app:access", Scope: "plugins:id:grafana-oncall-app", Origin: "grafana-oncall-app"},
			},
			want: want,
		},
		{
			desc: "seeded without any OnCall access",
			init: []SeedAssignment{{BuiltinRole: "Admin", Action: "plugins.app:access", Scope: "plugins:id:*"}},
			want: append(want, SeedAssignment{BuiltinRole: "Admin", Action: "plugins.app:access", Scope: "plugins:id:*"}),
		},
	}

	for _, tc := range tt {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id LIKE ?`, acmig.PreventSeedingOnCallAccessID+"%")
			require.NoError(t, errDeleteMig)
			_, errDeleteAssigns := x.Exec(`DELETE FROM seed_assignment`)
			require.NoError(t, errDeleteAssigns)

			if len(tc.init) > 0 {
				_, errInsertAssign := x.Table("seed_assignment").InsertMulti(tc.init)
				require.NoError(t, errInsertAssign)
			}

			// Run accesscontrol migration
			acmigrator := migrator.NewMigrator(x, setting.ProvideService(&setting.Cfg{Logger: log.New("acmigration.test")}))
			acmigrator.AddMigration(acmig.PreventSeedingOnCallAccessID, &acmig.SeedAssignmentOnCallAccessMigrator{})

			errRunningMig := acmigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			got := []SeedAssignment{}
			errFind := x.Table("seed_assignment").Find(&got)
			require.NoError(t, errFind)
			require.ElementsMatch(t, tc.want, got)
		})
	}
}

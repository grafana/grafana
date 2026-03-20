package federated

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	rest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDirectSQLStats(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db, cfg := db.InitTestDBWithCfg(t)
	ctx := context.Background()

	dashStore, err := database.ProvideDashboardStore(db, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(db))
	require.NoError(t, err)
	tempUser := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}}
	now := time.Now()

	ruleStore := ngalertstore.SetupStoreForTesting(t, db)
	dashboardUID := "test"
	_, err = ruleStore.InsertAlertRules(context.Background(), ngmodels.NewUserUID(tempUser), []ngmodels.InsertRule{{
		AlertRule: ngmodels.AlertRule{
			DashboardUID: &dashboardUID,
			UID:          "test",
			Title:        "test",
			OrgID:        1,
			Data: []ngmodels.AlertQuery{
				{
					RefID:         "A",
					Model:         json.RawMessage("{}"),
					DatasourceUID: expr.DatasourceUID,
					RelativeTimeRange: ngmodels.RelativeTimeRange{
						From: ngmodels.Duration(60),
						To:   ngmodels.Duration(0),
					},
				},
			},
			Condition:       "ok",
			Updated:         now,
			ExecErrState:    ngmodels.ExecutionErrorState(ngmodels.Alerting),
			NoDataState:     ngmodels.Alerting,
			IntervalSeconds: 60,
		}}})
	require.NoError(t, err)

	_, err = dashStore.SaveDashboard(ctx, dashboards.SaveDashboardCommand{
		Dashboard: simplejson.New(),
		OrgID:     1,
	})
	require.NoError(t, err)

	store := &LegacyStatsGetter{
		SQL: legacysql.NewDatabaseProvider(db),
	}

	// Helper to create a cfg with specific dual-writer modes
	cfgWithModes := func(dashboardsMode int) *setting.Cfg {
		return &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.DualWriterMode(dashboardsMode)},
			},
		}
	}

	t.Run("GetStatsForGeneralFolder", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
		})
		require.NoError(t, err)

		jj, _ := json.MarshalIndent(stats.Stats, "", "  ")
		// Note: folders are only stored in unified storage (k8s), not legacy SQL
		// so we only expect dashboards, alertrules, and library_elements from SQL fallback
		require.JSONEq(t, `[
			{
				"group": "sql-fallback",
				"resource": "alertrules",
				"count": 1
			},
			{
				"group": "sql-fallback",
				"resource": "dashboards",
				"count": 1
			},
			{
				"group": "sql-fallback",
				"resource": "library_elements"
			}
		]`, string(jj))
	})

	// New tests to verify per-resource fallback disabling
	t.Run("GetStatsForGeneralFolder_DisableDashboardsFallback", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		store := &LegacyStatsGetter{
			SQL: legacysql.NewDatabaseProvider(db),
			Cfg: cfgWithModes(5), // dashboards Mode5
		}

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
		})
		require.NoError(t, err)

		var hasDashboards, hasAlertRules bool
		for _, s := range stats.Stats {
			if s.Resource == "dashboards" {
				hasDashboards = true
			}
			if s.Resource == "alertrules" {
				hasAlertRules = true
			}
		}
		// dashboards are disabled in Mode5, but alertrules should still be present
		require.False(t, hasDashboards, "dashboards stats should be disabled")
		require.True(t, hasAlertRules, "alertrules should still be present")
	})

	// Verify that changing the cfg mode dynamically affects the stats query.
	// This is the key behavior for the fix: auto-migration sets Mode5 after the
	// LegacyStatsGetter is created, and the getter must pick up the change.
	t.Run("DynamicModeChange", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		cfg := cfgWithModes(0) // start with Mode0 for dashboards
		store := &LegacyStatsGetter{
			SQL: legacysql.NewDatabaseProvider(db),
			Cfg: cfg,
		}

		// With Mode0, legacy dashboard stats should be returned
		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
		})
		require.NoError(t, err)
		var hasDashboards bool
		for _, s := range stats.Stats {
			if s.Resource == "dashboards" {
				hasDashboards = true
			}
		}
		require.True(t, hasDashboards, "dashboards stats should be present in Mode0")

		// Simulate auto-migration setting Mode5 after client creation
		cfg.UnifiedStorage["dashboards.dashboard.grafana.app"] = setting.UnifiedStorageConfig{
			DualWriterMode: rest.Mode5,
		}

		// Now legacy dashboard stats should be skipped
		stats, err = store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
		})
		require.NoError(t, err)
		hasDashboards = false
		for _, s := range stats.Stats {
			if s.Resource == "dashboards" {
				hasDashboards = true
			}
		}
		require.False(t, hasDashboards, "dashboards stats should be disabled after Mode5 is set")
	})
}

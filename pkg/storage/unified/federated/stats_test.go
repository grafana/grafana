package federated

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
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
	fStore := folderimpl.ProvideStore(db)
	tempUser := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}}

	folder1UID := "test1"
	now := time.Now()
	dashFolder1 := dashboards.NewDashboardFolder("test1")
	dashFolder1.SetUID(folder1UID)
	dashFolder1.OrgID = 1
	dashFolder1.CreatedBy = tempUser.UserID
	dashFolder1.UpdatedBy = tempUser.UserID
	_, err = dashStore.SaveDashboard(ctx, dashboards.SaveDashboardCommand{
		Dashboard: dashFolder1.Data,
		OrgID:     1,
		UserID:    tempUser.UserID,
		IsFolder:  true,
	})
	require.NoError(t, err)
	_, err = fStore.Create(ctx, folder.CreateFolderCommand{Title: "test1", UID: folder1UID, OrgID: 1, SignedInUser: tempUser})
	require.NoError(t, err)

	folder2UID := "test2"
	dashFolder2 := dashboards.NewDashboardFolder("test2")
	dashFolder2.SetUID(folder2UID)
	dashFolder2.OrgID = 1
	dashFolder2.FolderUID = folder1UID
	dashFolder2.CreatedBy = tempUser.UserID
	dashFolder2.UpdatedBy = tempUser.UserID
	_, err = dashStore.SaveDashboard(ctx, dashboards.SaveDashboardCommand{
		Dashboard: dashFolder2.Data,
		OrgID:     1,
		UserID:    tempUser.UserID,
		IsFolder:  true,
		FolderUID: folder1UID,
	})
	require.NoError(t, err)
	_, err = fStore.Create(ctx, folder.CreateFolderCommand{Title: "test2", UID: folder2UID, OrgID: 1, ParentUID: folder1UID, SignedInUser: tempUser})
	require.NoError(t, err)

	ruleStore := ngalertstore.SetupStoreForTesting(t, db)
	_, err = ruleStore.InsertAlertRules(context.Background(), ngmodels.NewUserUID(tempUser), []ngmodels.AlertRule{
		{
			DashboardUID: &folder2UID,
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
			NamespaceUID:    "test",
			ExecErrState:    ngmodels.ExecutionErrorState(ngmodels.Alerting),
			NoDataState:     ngmodels.Alerting,
			IntervalSeconds: 60,
		}})
	require.NoError(t, err)

	_, err = dashStore.SaveDashboard(ctx, dashboards.SaveDashboardCommand{
		Dashboard: simplejson.New(),
		FolderUID: folder1UID,
		OrgID:     1,
	})
	require.NoError(t, err)

	store := &LegacyStatsGetter{
		SQL: legacysql.NewDatabaseProvider(db),
	}

	t.Run("GetStatsForFolder1", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    folder1UID,
		})
		require.NoError(t, err)

		jj, _ := json.MarshalIndent(stats.Stats, "", "  ")
		require.JSONEq(t, `[
			{
				"group": "sql-fallback",
				"resource": "alertrules"
			},
			{
				"group": "sql-fallback",
				"resource": "dashboards",
				"count": 1
			},
			{
				"group": "sql-fallback",
				"resource": "folders",
				"count": 1
			},
			{
				"group": "sql-fallback",
				"resource": "library_elements"
			}
		]`, string(jj))
	})

	// New tests to verify per-resource fallback disabling
	t.Run("GetStatsForFolder1_DisableDashboardsFallback", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		store := &LegacyStatsGetter{
			SQL:                          legacysql.NewDatabaseProvider(db),
			DisableSQLFallbackDashboards: true,
			DisableSQLFallbackFolders:    false,
		}

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    folder1UID,
		})
		require.NoError(t, err)

		var hasDashboards, hasFolders bool
		for _, s := range stats.Stats {
			if s.Resource == "dashboards" {
				hasDashboards = true
			}
			if s.Resource == "folders" {
				hasFolders = true
				require.EqualValues(t, 1, s.Count)
			}
		}
		require.False(t, hasDashboards, "dashboards stats should be disabled")
		require.True(t, hasFolders, "folders stats should be present")
	})

	t.Run("GetStatsForFolder1_DisableFoldersFallback", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		store := &LegacyStatsGetter{
			SQL:                          legacysql.NewDatabaseProvider(db),
			DisableSQLFallbackDashboards: false,
			DisableSQLFallbackFolders:    true,
		}

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    folder1UID,
		})
		require.NoError(t, err)

		var hasDashboards, hasFolders bool
		for _, s := range stats.Stats {
			if s.Resource == "dashboards" {
				hasDashboards = true
				require.EqualValues(t, 1, s.Count)
			}
			if s.Resource == "folders" {
				hasFolders = true
			}
		}
		require.True(t, hasDashboards, "dashboards stats should be present")
		require.False(t, hasFolders, "folders stats should be disabled")
	})

	t.Run("GetStatsForFolder1_DisableBothFallbacks", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		store := &LegacyStatsGetter{
			SQL:                          legacysql.NewDatabaseProvider(db),
			DisableSQLFallbackDashboards: true,
			DisableSQLFallbackFolders:    true,
		}

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    folder1UID,
		})
		require.NoError(t, err)

		var hasDashboards, hasFolders bool
		var hasAlertRules, hasLibrary bool
		for _, s := range stats.Stats {
			if s.Resource == "dashboards" {
				hasDashboards = true
			}
			if s.Resource == "folders" {
				hasFolders = true
			}
			if s.Resource == "alertrules" {
				hasAlertRules = true
			}
			if s.Resource == "library_elements" {
				hasLibrary = true
			}
		}
		require.False(t, hasDashboards, "dashboards stats should be disabled")
		require.False(t, hasFolders, "folders stats should be disabled")
		require.True(t, hasAlertRules, "alertrules should still be present")
		require.True(t, hasLibrary, "library_elements should still be present")
	})

	t.Run("GetStatsForFolder2", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    folder2UID,
		})
		require.NoError(t, err)

		jj, _ := json.MarshalIndent(stats.Stats, "", "  ")
		require.JSONEq(t, `[
			{
				"group": "sql-fallback",
				"resource": "alertrules",
				"count": 1
			},
			{
				"group": "sql-fallback",
				"resource": "dashboards"
			},
			{
				"group": "sql-fallback",
				"resource": "folders"
			},
			{
				"group": "sql-fallback",
				"resource": "library_elements"
			}
		]`, string(jj))
	})
}

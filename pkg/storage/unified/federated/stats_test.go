package federated

import (
	"testing"

	// "github.com/grafana/grafana/pkg/services/folder/folderimpl"

	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

/*
func TestDirectSQLStats(t *testing.T) {
	db, cfg := db.InitTestDBWithCfg(t)
	ctx := context.Background()

	dashStore, err := database.ProvideDashboardStore(db, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(db))
	require.NoError(t, err)
	fakeGuardian := &guardian.FakeDashboardGuardian{
		CanSaveValue: true,
		CanEditUIDs:  []string{},
		CanViewUIDs:  []string{},
	}
	guardian.MockDashboardGuardian(fakeGuardian)
	require.NoError(t, err)
	fStore := folderimpl.ProvideStore(db)
	folderSvc := folderimpl.ProvideService(fStore, actest.FakeAccessControl{ExpectedEvaluate: true}, bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore,
		folderimpl.ProvideDashboardFolderStore(db), db, featuremgmt.WithFeatures(),
		supportbundlestest.NewFakeBundleService(), cfg, nil, tracing.InitializeTracerForTest())

	// create parent folder

	tempUser := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}}

	// create folders - test2 is nested in test1
	folder1UID := "test1"
	now := time.Now()
	_, err = folderSvc.Create(ctx, &folder.CreateFolderCommand{Title: "test1", UID: folder1UID, OrgID: 1, SignedInUser: tempUser})
	require.NoError(t, err)
	folder2UID := "test2"
	_, err = folderSvc.Create(ctx, &folder.CreateFolderCommand{Title: "test2", UID: folder2UID, OrgID: 1, ParentUID: folder1UID, SignedInUser: tempUser})
	require.NoError(t, err)

	// create an alert rule inside of folder test2
	ruleStore := ngalertstore.SetupStoreForTesting(t, db)
	_, err = ruleStore.InsertAlertRules(context.Background(), []ngmodels.AlertRule{
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

	// finally, create dashboard inside of test1
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

		stats, err := store.GetStats(ctx, &resource.ResourceStatsRequest{
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

	t.Run("GetStatsForFolder2", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		stats, err := store.GetStats(ctx, &resource.ResourceStatsRequest{
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
*/

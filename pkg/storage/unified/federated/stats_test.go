package federated

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	tptestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDirectSQLStats(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db, _ := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ctx := context.Background()

	tempUser := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}}

	folder1UID := "test1"
	folder2UID := "test2"
	now := time.Now()

	fStore := folder.NewFakeStore()
	fStore.ExpectedFolder = &folder.Folder{UID: folder1UID, OrgID: 1, Title: "test1"}
	_, err := fStore.Create(ctx, folder.CreateFolderCommand{Title: "test1", UID: folder1UID, OrgID: 1, SignedInUser: tempUser})
	require.NoError(t, err)
	fStore.ExpectedFolder = &folder.Folder{UID: folder2UID, OrgID: 1, Title: "test2", ParentUID: folder1UID}
	_, err = fStore.Create(ctx, folder.CreateFolderCommand{Title: "test2", UID: folder2UID, OrgID: 1, ParentUID: folder1UID, SignedInUser: tempUser})
	require.NoError(t, err)

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
			NamespaceUID:    folder2UID,
			ExecErrState:    ngmodels.ExecutionErrorState(ngmodels.Alerting),
			NoDataState:     ngmodels.Alerting,
			IntervalSeconds: 60,
		}}})
	require.NoError(t, err)

	store := &LegacyStatsGetter{
		SQL: legacysql.NewDatabaseProvider(db),
	}

	t.Run("GetStatsForFolder1", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    []string{folder1UID},
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
				"resource": "recordingrules"
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

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    []string{folder2UID},
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
				"resource": "recordingrules"
			},
			{
				"group": "sql-fallback",
				"resource": "library_elements"
			}
		]`, string(jj))
	})

	// Folder1 has no rules directly but folder2 (its child) does. With
	// the descendant subtree pre-expanded by the caller, the legacy count
	// must include the child folder's rule — same recursive semantics as
	// the unified path.
	t.Run("GetStatsForFolder1Recursive", func(t *testing.T) {
		ctx := context.Background()
		ctx = request.WithNamespace(ctx, "default")

		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    []string{folder1UID, folder2UID},
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
				"resource": "recordingrules"
			},
			{
				"group": "sql-fallback",
				"resource": "library_elements"
			}
		]`, string(jj))
	})
}

// Alert rules and recording rules live in the same table and are told apart by the
// `record` column, so the fallback has to report them under separate resources. If it
// lumped both into "alertrules", callers that read both kinds would count every
// recording rule twice.
func TestIntegrationDirectSQLStatsSplitsRecordingRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db, _ := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ctx := request.WithNamespace(context.Background(), "default")

	tempUser := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}}
	ruleStore := ngalertstore.SetupStoreForTesting(t, db)

	insert := func(t *testing.T, uid, folderUID string, record *ngmodels.Record) {
		t.Helper()
		_, err := ruleStore.InsertAlertRules(context.Background(), ngmodels.NewUserUID(tempUser), []ngmodels.InsertRule{{
			AlertRule: ngmodels.AlertRule{
				UID:   uid,
				Title: uid,
				OrgID: 1,
				Data: []ngmodels.AlertQuery{{
					RefID:             "A",
					Model:             json.RawMessage("{}"),
					DatasourceUID:     expr.DatasourceUID,
					RelativeTimeRange: ngmodels.RelativeTimeRange{From: ngmodels.Duration(60), To: ngmodels.Duration(0)},
				}},
				Condition:       "A",
				Updated:         time.Now(),
				NamespaceUID:    folderUID,
				ExecErrState:    ngmodels.ExecutionErrorState(ngmodels.Alerting),
				NoDataState:     ngmodels.Alerting,
				IntervalSeconds: 60,
				Record:          record,
			}}})
		require.NoError(t, err)
	}

	rec := func(metric string) *ngmodels.Record {
		return &ngmodels.Record{Metric: metric, From: "A", TargetDatasourceUID: "some-ds"}
	}

	// recording rules only -- the case the folder counts previously got wrong
	insert(t, "rec-1", "folder-rec", rec("m1"))
	insert(t, "rec-2", "folder-rec", rec("m2"))
	// a mix of both kinds
	insert(t, "mix-alert", "folder-mix", nil)
	insert(t, "mix-rec", "folder-mix", rec("m3"))

	store := &LegacyStatsGetter{SQL: legacysql.NewDatabaseProvider(db)}

	counts := func(t *testing.T, folderUID string) map[string]int64 {
		t.Helper()
		stats, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: "default",
			Folder:    []string{folderUID},
		})
		require.NoError(t, err)
		out := map[string]int64{}
		for _, s := range stats.Stats {
			require.Equal(t, "sql-fallback", s.Group)
			out[s.Resource] = s.Count
		}
		return out
	}

	t.Run("folder with only recording rules", func(t *testing.T) {
		got := counts(t, "folder-rec")
		require.Equal(t, int64(0), got["alertrules"])
		require.Equal(t, int64(2), got["recordingrules"])
	})

	t.Run("folder with both kinds", func(t *testing.T) {
		got := counts(t, "folder-mix")
		require.Equal(t, int64(1), got["alertrules"])
		require.Equal(t, int64(1), got["recordingrules"])
	})

	// The two predicates must partition the table: every row lands in exactly one
	// count. If a row fell through both, a folder that still holds rules would look
	// empty and the delete-safety check would let it be deleted.
	t.Run("every rule is counted exactly once", func(t *testing.T) {
		for folderUID, total := range map[string]int64{"folder-rec": 2, "folder-mix": 2} {
			got := counts(t, folderUID)
			require.Equal(t, total, got["alertrules"]+got["recordingrules"],
				"alertrules+recordingrules must equal the number of rules in %s", folderUID)
		}
	})
}

func TestIntegrationLegacyTableIsStale(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfgWithMode := func(resource string, mode grafanarest.DualWriterMode) *setting.Cfg {
		return &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			resource: {DualWriterMode: mode},
		}}
	}

	// legacyTableIsStale queries kv_store when Cfg is nil, so every case needs a real
	// session/helper, even the ones exercising the config-based fast path.
	// The check itself must run inside the WithDbSession callback -- the session isn't
	// valid once that callback returns.
	withSession := func(t *testing.T, check func(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper)) {
		t.Helper()
		testDB, _ := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		provider := legacysql.NewDatabaseProvider(testDB)
		helper, err := provider(context.Background())
		require.NoError(t, err)
		require.NoError(t, helper.DB.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			check(sess, helper)
			return nil
		}))
	}

	t.Run("no config means the legacy table is still the source of truth", func(t *testing.T) {
		s := &LegacyStatsGetter{}
		withSession(t, func(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper) {
			stale, err := s.legacyTableIsStale(sess, helper, alertRuleResource)
			require.NoError(t, err)
			require.False(t, stale)
		})
	})

	t.Run("unconfigured resource is still the source of truth", func(t *testing.T) {
		s := &LegacyStatsGetter{Cfg: cfgWithMode(libraryPanelResource, grafanarest.Mode5)}
		withSession(t, func(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper) {
			stale, err := s.legacyTableIsStale(sess, helper, alertRuleResource)
			require.NoError(t, err)
			require.False(t, stale)
		})
	})

	t.Run("dual write modes keep the legacy table", func(t *testing.T) {
		for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode0, grafanarest.Mode1, grafanarest.Mode2, grafanarest.Mode3} {
			s := &LegacyStatsGetter{Cfg: cfgWithMode(alertRuleResource, mode)}
			withSession(t, func(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper) {
				stale, err := s.legacyTableIsStale(sess, helper, alertRuleResource)
				require.NoError(t, err)
				require.False(t, stale, "mode %d", mode)
			})
		}
	})

	t.Run("unified storage modes drop the legacy table", func(t *testing.T) {
		for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode4, grafanarest.Mode5} {
			s := &LegacyStatsGetter{Cfg: cfgWithMode(alertRuleResource, mode)}
			withSession(t, func(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper) {
				stale, err := s.legacyTableIsStale(sess, helper, alertRuleResource)
				require.NoError(t, err)
				require.True(t, stale, "mode %d", mode)
			})
		}
	})

	t.Run("library panels migration makes legacy counts stale in dual-write mode", func(t *testing.T) {
		ctx := context.Background()
		testDB, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		require.NoError(t, migrations.EnsureMigrationLogTable(ctx, testDB, cfg))
		helper, err := legacysql.NewDatabaseProvider(testDB)(ctx)
		require.NoError(t, err)
		s := &LegacyStatsGetter{Cfg: cfgWithMode(libraryPanelResource, grafanarest.Mode1)}
		insertLog := "INSERT INTO " + helper.Table(migrationLogTable) + " (" + helper.DB.Quote("migration_id") + ", " +
			helper.DB.Quote("sql") + ", " + helper.DB.Quote("success") + ", " + helper.DB.Quote("error") + ", " +
			helper.DB.Quote("timestamp") + ") VALUES (?, ?, ?, ?, ?)"
		require.NoError(t, testDB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			stale, err := s.legacyTableIsStale(sess, helper, libraryPanelResource)
			require.NoError(t, err)
			require.False(t, stale)

			_, err = sess.Exec(insertLog,
				libraryPanelMigration, "test", false, "test failure", time.Now())
			require.NoError(t, err)
			stale, err = s.legacyTableIsStale(sess, helper, libraryPanelResource)
			require.NoError(t, err)
			require.False(t, stale)

			_, err = sess.Exec(insertLog,
				libraryPanelMigration, "test", true, "", time.Now())
			require.NoError(t, err)
			stale, err = s.legacyTableIsStale(sess, helper, libraryPanelResource)
			require.NoError(t, err)
			require.True(t, stale)
			return nil
		}))
	})

	t.Run("nil Cfg falls back to the per-stack kv_store marker", func(t *testing.T) {
		s := &LegacyStatsGetter{}
		withSession(t, func(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper) {
			_, err := sess.Exec("INSERT INTO "+helper.Table("kv_store")+" (org_id, namespace, "+helper.DB.Quote("key")+", value, created, updated) VALUES (0, ?, ?, ?, ?, ?)",
				migratedKVNamespace, alertRuleResource, migratedKVValue, time.Now(), time.Now())
			require.NoError(t, err)

			stale, err := s.legacyTableIsStale(sess, helper, alertRuleResource)
			require.NoError(t, err)
			require.True(t, stale)

			// A different resource's key must not be affected.
			stale, err = s.legacyTableIsStale(sess, helper, recordingRuleResource)
			require.NoError(t, err)
			require.False(t, stale)
		})
	})
}

func TestIntegrationLegacyStatsRecordMetrics(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	migrated := func(resource string) *setting.Cfg {
		return &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			resource: {DualWriterMode: grafanarest.Mode5},
		}}
	}
	logger := newRecordingLogger()
	run := func(t *testing.T, cfg *setting.Cfg) (*prometheus.Registry, *legacyStatsMetrics) {
		t.Helper()
		*logger.lines = nil
		testDB, _ := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		reg := prometheus.NewRegistry()
		m := newLegacyStatsMetrics(reg)
		store := &LegacyStatsGetter{SQL: withServer(legacysql.NewDatabaseProvider(testDB), "db-1"), Cfg: cfg, metrics: m, logger: logger}
		_, err := store.GetStats(request.WithNamespace(context.Background(), "default"), &resourcepb.ResourceStatsRequest{Namespace: "default", Folder: []string{"f1"}})
		require.NoError(t, err)
		return reg, m
	}

	t.Run("each counted resource records a duration", func(t *testing.T) {
		reg, m := run(t, nil)
		for _, name := range legacyResources {
			require.Equal(t, uint64(1), observations(t, reg, name, legacyOutcomeOK), name)
			require.Equal(t, 0.0, tptestutil.ToFloat64(m.skipped.WithLabelValues(name, legacySkipMigrated)), name)
		}
		counted := logger.withMsg("Counted legacy resources")
		require.Len(t, counted, 3)
		for _, l := range counted {
			require.Equal(t, "debug", l.level)
			require.Equal(t, "db-1", l.fields["dbServer"])
			require.Equal(t, "default", l.fields["namespace"])
			require.Equal(t, "f1", l.fields["folder"])
			require.Equal(t, legacyOutcomeOK, l.fields["outcome"])
			require.Contains(t, l.fields, "duration")
		}
	})

	for name, configKey := range map[string]string{
		legacyAlertRules:      alertRuleResource,
		legacyRecordingRules:  recordingRuleResource,
		legacyLibraryElements: libraryPanelResource,
	} {
		t.Run("a migrated "+name+" is skipped, not timed", func(t *testing.T) {
			reg, m := run(t, migrated(configKey))
			for _, other := range legacyResources {
				if other == name {
					require.Equal(t, 1.0, tptestutil.ToFloat64(m.skipped.WithLabelValues(other, legacySkipMigrated)), other)
					require.Equal(t, uint64(0), observations(t, reg, other, legacyOutcomeOK), other)
					continue
				}
				require.Equal(t, 0.0, tptestutil.ToFloat64(m.skipped.WithLabelValues(other, legacySkipMigrated)), other)
				require.Equal(t, uint64(1), observations(t, reg, other, legacyOutcomeOK), "%s still runs", other)
			}
			skipped := logger.withMsg("Skipped legacy count")
			require.Len(t, skipped, 1)
			require.Equal(t, name, skipped[0].fields["resource"])
			require.Equal(t, legacySkipMigrated, skipped[0].fields["reason"])
			require.Equal(t, "db-1", skipped[0].fields["dbServer"])
		})
	}
}

func TestIntegrationLegacyStatsRecordsFailedStalenessCheck(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testDB, _ := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	ctx := request.WithNamespace(context.Background(), "default")
	// With no Cfg the staleness check reads kv_store. Pointing it at a table that doesn't exist
	// makes the check fail without touching the shared test database.
	provider := func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{DB: testDB, Table: func(n string) string {
			if n == "kv_store" {
				return "kv_store_missing"
			}
			return n
		}}, nil
	}
	reg := prometheus.NewRegistry()
	logger := newRecordingLogger()
	store := &LegacyStatsGetter{SQL: withServer(provider, "db-1"), metrics: newLegacyStatsMetrics(reg), logger: logger}

	_, err := store.GetStats(ctx, &resourcepb.ResourceStatsRequest{Namespace: "default", Folder: []string{"f1"}})

	var countErr *CountError
	require.ErrorAs(t, err, &countErr)
	require.Equal(t, []string{legacyAlertRules}, countErr.Resources)
	require.Equal(t, uint64(1), observations(t, reg, legacyAlertRules, legacyOutcomeError))
	require.Equal(t, uint64(0), observations(t, reg, legacyRecordingRules, legacyOutcomeError), "the first failure ends the request")

	failed := logger.withMsg("Legacy count failed")
	require.Len(t, failed, 1)
	require.Equal(t, "error", failed[0].level)
	require.Equal(t, legacyAlertRules, failed[0].fields["resource"])
	require.Equal(t, "db-1", failed[0].fields["dbServer"])
	require.Equal(t, legacyOutcomeError, failed[0].fields["outcome"])
	require.NotNil(t, failed[0].fields["error"])
}

// withServer names the database server on the helpers a provider returns.
func withServer(p legacysql.LegacyDatabaseProvider, server string) legacysql.LegacyDatabaseProvider {
	return func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		h, err := p(ctx)
		if err != nil {
			return nil, err
		}
		c := *h
		c.Server = server
		return &c, nil
	}
}

func TestIntegrationLegacyStatsTimesEachChunkQuery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testDB, _ := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	reg := prometheus.NewRegistry()
	store := &LegacyStatsGetter{SQL: legacysql.NewDatabaseProvider(testDB), metrics: newLegacyStatsMetrics(reg)}
	folders := make([]string, 2*folderBatchSize+1)
	for i := range folders {
		folders[i] = fmt.Sprintf("folder-%d", i)
	}

	_, err := store.GetStats(request.WithNamespace(context.Background(), "default"), &resourcepb.ResourceStatsRequest{Namespace: "default", Folder: folders})
	require.NoError(t, err)

	for _, name := range legacyResources {
		require.Equal(t, uint64(3), observations(t, reg, name, legacyOutcomeOK), "%s: one observation per chunk", name)
	}
}

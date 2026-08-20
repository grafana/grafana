package federated

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
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

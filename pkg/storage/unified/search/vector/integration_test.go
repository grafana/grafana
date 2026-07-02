package vector

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const testModel = "test-model"
const testResource = "dashboards"

var testSubtree = subtreeName(testResource)

// To run: start the pgvector devenv (localhost:5433) and
//
//	PGVECTOR_TEST_DB="host=localhost port=5433 dbname=grafana_vectors user=grafana password=password sslmode=disable" \
//	  go test -run TestIntegration ./pkg/storage/unified/search/vector/... -v -count=1
func setupIntegrationTest(t *testing.T) (VectorBackend, *xorm.Engine, context.Context) {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)

	connStr := os.Getenv("PGVECTOR_TEST_DB")
	if connStr == "" {
		t.Skip("PGVECTOR_TEST_DB not set, skipping pgvector integration test")
	}

	ctx := context.Background()

	engine, err := xorm.NewEngine("postgres", connStr)
	require.NoError(t, err)
	t.Cleanup(func() {
		if err := engine.Close(); err != nil {
			t.Logf("closing xorm engine: %v", err)
		}
	})

	cfg := setting.NewCfg()
	err = MigrateVectorStore(ctx, engine, cfg)
	require.NoError(t, err)

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	// interval=0 keeps the promoter idle; promotion tests call Promote(ctx) directly.
	backend := NewPgvectorBackend(ctx, database, 1000, 0, false, engine)

	cleanIntegrationState(t, engine)

	return backend, engine, ctx
}

// cleanIntegrationState drops any `integration-test*` partial indexes, clears
// rows, and resets the checkpoint.
func cleanIntegrationState(t *testing.T, engine *xorm.Engine) {
	t.Helper()
	ctx := context.Background()

	indexPrefix := fmt.Sprintf("%s_integration_test", testResource)
	rows, err := engine.DB().QueryContext(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_index i ON i.indexrelid = c.oid
		JOIN pg_class t ON t.oid = i.indrelid
		WHERE t.relname = $1 AND c.relkind = 'i' AND c.relname LIKE $2`,
		testSubtree, indexPrefix+"%")
	require.NoError(t, err)
	var indexes []string
	for rows.Next() {
		var n string
		require.NoError(t, rows.Scan(&n))
		indexes = append(indexes, n)
	}
	_ = rows.Close()

	for _, idx := range indexes {
		_, _ = engine.DB().ExecContext(ctx, fmt.Sprintf(`DROP INDEX IF EXISTS %s`, idx))
	}

	_, _ = engine.DB().ExecContext(ctx,
		fmt.Sprintf(`DELETE FROM %s WHERE namespace LIKE 'integration-test%%'`, testSubtree))
	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM vector_promoted WHERE namespace LIKE 'integration-test%'`)
	_, _ = engine.DB().ExecContext(ctx,
		`UPDATE vector_latest_rv SET latest_rv = 0 WHERE id = 1`)
	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM vector_backfill_jobs WHERE model = $1`, testModel)
}

func TestIntegrationVectorUpsertAndSearch(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	vectors := []Vector{
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-1", Title: "CPU Dashboard", Subresource: "panel/1",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "CPU usage over time for production servers",
			Metadata:  json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding: makeEmbedding(0.9, 0.1), Model: testModel,
		},
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-1", Title: "CPU Dashboard", Subresource: "panel/2",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "Memory usage alerts dashboard",
			Metadata:  json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding: makeEmbedding(0.1, 0.9), Model: testModel,
		},
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-2", Title: "Logs Dashboard", Subresource: "panel/1",
			ResourceVersion: 20, Folder: "folder-b",
			Content:   "Log volume by service",
			Metadata:  json.RawMessage(`{"datasource_uids":["loki-1"],"query_languages":["logql"]}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		},
	}

	require.NoError(t, backend.Upsert(ctx, vectors))

	results, err := backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.85, 0.15), 10)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(results), 3)
	assert.Equal(t, "dash-1", results[0].UID)
	assert.Equal(t, "CPU Dashboard", results[0].Title)
	assert.Equal(t, "panel/1", results[0].Subresource)

	results, err = backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "uid", Values: []string{"dash-2"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].UID)

	results, err = backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "folder", Values: []string{"folder-a"}})
	require.NoError(t, err)
	require.Len(t, results, 2)

	results, err = backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "query_languages", Values: []string{"logql"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].UID)
}

func TestIntegrationVectorDeleteSubresources(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	err := backend.Upsert(ctx, []Vector{
		{Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/1",
			ResourceVersion: 10, Content: "panel one", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		{Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/2",
			ResourceVersion: 10, Content: "panel two", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		{Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/3",
			ResourceVersion: 10, Content: "panel three", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
	})
	require.NoError(t, err)

	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	require.Len(t, stored, 3)

	current := map[string]string{"panel/1": "panel one"}
	var toDelete []string
	for sub := range stored {
		if _, ok := current[sub]; !ok {
			toDelete = append(toDelete, sub)
		}
	}
	require.ElementsMatch(t, []string{"panel/2", "panel/3"}, toDelete)

	err = backend.DeleteSubresources(ctx, "integration-test", testModel, testResource, "dash", toDelete)
	require.NoError(t, err)

	results, err := backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "panel/1", results[0].Subresource)

	err = backend.Delete(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
}

// TestIntegrationVectorUpsertReplaceSubresources pins the atomic
// "replace the stored subresource set for this UID" contract the
// reconciler depends on: subresources not present in the new write get
// deleted, present ones get rewritten, and nothing about other UIDs or
// the rest of the namespace changes.
func TestIntegrationVectorUpsertReplaceSubresources(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	mk := func(uid, sub, content string) Vector {
		return Vector{
			Namespace: "integration-test", Resource: testResource, UID: uid, Title: uid,
			Subresource: sub, ResourceVersion: 10, Content: content, Folder: "folder-a",
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		}
	}

	// Seed dash-a with three panels and dash-b with two; dash-b is the
	// "untouched neighbor" used to assert isolation.
	require.NoError(t, backend.Upsert(ctx, []Vector{
		mk("dash-a", "panel/1", "a-1"),
		mk("dash-a", "panel/2", "a-2"),
		mk("dash-a", "panel/3", "a-3"),
		mk("dash-b", "panel/1", "b-1"),
		mk("dash-b", "panel/2", "b-2"),
	}))

	// Replace dash-a with just panel/1 (rewritten) and panel/4 (new).
	// panel/2 and panel/3 must be deleted in the same transaction.
	// desired = the full surviving set; changed = the rows to write.
	err := backend.UpsertReplaceSubresources(ctx, "integration-test", testModel, testResource, "dash-a", []Vector{
		mk("dash-a", "panel/1", "a-1 updated"),
		mk("dash-a", "panel/4", "a-4 new"),
	}, []string{"panel/1", "panel/4"})
	require.NoError(t, err)

	stored, folder, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash-a")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"panel/1": "a-1 updated",
		"panel/4": "a-4 new",
	}, stored, "stale subresources removed; new set is the exact replacement")
	assert.Equal(t, "folder-a", folder, "stored folder is returned alongside content")

	// dash-b must be untouched.
	storedB, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash-b")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"panel/1": "b-1",
		"panel/2": "b-2",
	}, storedB, "neighbor UID is isolated from the replace")

	require.NoError(t, backend.Delete(ctx, "integration-test", testModel, testResource, "dash-a"))
	require.NoError(t, backend.Delete(ctx, "integration-test", testModel, testResource, "dash-b"))
}

// changed ⊊ desired: only `changed` rows are rewritten, panels in
// `desired` but not `changed` are kept, and nothing is deleted.
func TestIntegrationVectorUpsertReplaceSubresources_PartialUpdate(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	mk := func(uid, sub, content string) Vector {
		return Vector{
			Namespace: "integration-test", Resource: testResource, UID: uid, Title: uid,
			Subresource: sub, ResourceVersion: 1, Content: content,
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		}
	}

	require.NoError(t, backend.Upsert(ctx, []Vector{
		mk("dash", "panel/1", "p1"),
		mk("dash", "panel/2", "p2"),
		mk("dash", "panel/3", "p3"),
	}))

	require.NoError(t, backend.UpsertReplaceSubresources(ctx, "integration-test", testModel, testResource, "dash",
		[]Vector{
			mk("dash", "panel/2", "p2 v2"), // changed
			mk("dash", "panel/9", "p9"),    // new
		},
		[]string{"panel/1", "panel/2", "panel/3", "panel/9"},
	))

	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"panel/1": "p1",    // untouched (kept via desired, not in changed)
		"panel/2": "p2 v2", // rewritten
		"panel/3": "p3",    // untouched
		"panel/9": "p9",    // new
	}, stored)

	require.NoError(t, backend.Delete(ctx, "integration-test", testModel, testResource, "dash"))
}

// Empty `changed`: a panel is dropped from `desired` and deleted, with nothing to upsert.
func TestIntegrationVectorUpsertReplaceSubresources_DeleteOnlyNoChange(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	mk := func(uid, sub, content string) Vector {
		return Vector{
			Namespace: "integration-test", Resource: testResource, UID: uid, Title: uid,
			Subresource: sub, ResourceVersion: 1, Content: content,
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		}
	}

	require.NoError(t, backend.Upsert(ctx, []Vector{
		mk("dash", "panel/1", "p1"),
		mk("dash", "panel/2", "p2"),
	}))

	// No changed vectors; desired drops panel/2.
	require.NoError(t, backend.UpsertReplaceSubresources(ctx, "integration-test", testModel, testResource, "dash",
		nil, []string{"panel/1"}))

	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "p1"}, stored)

	require.NoError(t, backend.Delete(ctx, "integration-test", testModel, testResource, "dash"))
}

// TestIntegrationVectorUpsertReplaceSubresources_EmptyInput is the
// no-op early-return path. Existing rows stay put.
func TestIntegrationVectorUpsertReplaceSubresources_EmptyInput(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	require.NoError(t, backend.Upsert(ctx, []Vector{{
		Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash",
		Subresource: "panel/1", ResourceVersion: 1, Content: "untouched",
		Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
	}}))

	require.NoError(t, backend.UpsertReplaceSubresources(ctx, "integration-test", testModel, testResource, "dash", nil, nil))

	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "untouched"}, stored)

	require.NoError(t, backend.Delete(ctx, "integration-test", testModel, testResource, "dash"))
}

// TestIntegrationVectorUpsertReplaceSubresources_AtomicOnValidationError
// pins the all-or-nothing contract: when a vector in the batch fails
// validation, no rows in the batch are persisted and no stale rows
// are deleted. The reconciler depends on this so a half-applied
// dashboard never appears in search.
func TestIntegrationVectorUpsertReplaceSubresources_AtomicOnValidationError(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	mk := func(uid, sub, content string) Vector {
		return Vector{
			Namespace: "integration-test", Resource: testResource, UID: uid, Title: uid,
			Subresource: sub, ResourceVersion: 1, Content: content,
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		}
	}

	require.NoError(t, backend.Upsert(ctx, []Vector{
		mk("dash", "panel/1", "v1"),
		mk("dash", "panel/2", "v1"),
	}))

	// Second vector has empty Title — Validate() rejects it.
	bad := mk("dash", "panel/2", "v2-bad")
	bad.Title = ""
	err := backend.UpsertReplaceSubresources(ctx, "integration-test", testModel, testResource, "dash", []Vector{
		mk("dash", "panel/1", "v2"),
		bad,
	}, []string{"panel/1", "panel/2"})
	require.Error(t, err)

	// State is unchanged: panel/1 still has v1 content, panel/2 still present.
	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "v1", "panel/2": "v1"}, stored,
		"failed batch leaves no half-applied state")

	require.NoError(t, backend.Delete(ctx, "integration-test", testModel, testResource, "dash"))
}

func TestIntegrationVectorExists(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	exists, err := backend.Exists(ctx, "integration-test", testModel, testResource, "exists-dash")
	require.NoError(t, err)
	assert.False(t, exists, "no rows yet, Exists should be false")

	require.NoError(t, backend.Upsert(ctx, []Vector{
		{Namespace: "integration-test", Resource: testResource, UID: "exists-dash", Title: "T",
			Subresource: "panel/1", ResourceVersion: 1, Content: "x",
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
	}))

	exists, err = backend.Exists(ctx, "integration-test", testModel, testResource, "exists-dash")
	require.NoError(t, err)
	assert.True(t, exists, "after upsert Exists should be true")

	exists, err = backend.Exists(ctx, "integration-test", testModel, testResource, "nonexistent-dash")
	require.NoError(t, err)
	assert.False(t, exists)

	exists, err = backend.Exists(ctx, "integration-test", "different-model", testResource, "exists-dash")
	require.NoError(t, err)
	assert.False(t, exists, "different model should be treated as not-exists")
}

func TestIntegrationVectorGetLatestRV(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rv)

	require.NoError(t, backend.SetLatestRV(ctx, 42))
	rv, err = backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)

	// Monotonic: lower rv is ignored.
	require.NoError(t, backend.SetLatestRV(ctx, 10))
	rv, err = backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)

	// Higher rv advances.
	require.NoError(t, backend.SetLatestRV(ctx, 100))
	rv, err = backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(100), rv)
}

func TestIntegrationVectorCreateBackfillJob(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	require.NoError(t, backend.CreateBackfillJob(ctx, testModel, testResource, 100))

	// Second insert for the same (model, resource) is a no-op (ON CONFLICT
	// DO NOTHING): the original row is preserved, not overwritten with 200.
	require.NoError(t, backend.CreateBackfillJob(ctx, testModel, testResource, 200))

	jobs, err := backend.ListIncompleteBackfillJobs(ctx, testModel)
	require.NoError(t, err)
	require.Len(t, jobs, 1, "exactly one job exists after the conflicting insert")
	assert.Equal(t, int64(100), jobs[0].StoppingRV, "original stopping_rv preserved")
}

func TestIntegrationVectorReconcilerLock(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	release, acquired, err := backend.TryAcquireReconcilerLock(ctx)
	require.NoError(t, err)
	require.True(t, acquired)
	defer release()

	// Second acquire on the same backend (different connection) must be denied.
	_, acquired2, err := backend.TryAcquireReconcilerLock(ctx)
	require.NoError(t, err)
	require.False(t, acquired2)
}

func TestIntegrationPromoterPromotesLargeTenant(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const ns = "integration-test-big"
	const threshold = 50
	const nRows = threshold + 10

	vectors := make([]Vector, 0, nRows)
	for i := 0; i < nRows; i++ {
		vectors = append(vectors, Vector{
			Namespace: ns, Resource: testResource, UID: "dash", Title: "Dash", Subresource: fmt.Sprintf("panel/%d", i),
			ResourceVersion: int64(i + 1), Content: fmt.Sprintf("content %d", i),
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		})
	}
	require.NoError(t, backend.Upsert(ctx, vectors))

	idxName := partialHNSWName(testResource, ns)
	require.False(t, indexExists(t, engine, idxName))
	require.Equal(t, nRows, countRowsIn(t, engine, testSubtree, ns))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	promoter := NewPromoter(database, threshold, 0)
	require.NoError(t, promoter.Promote(ctx))

	require.True(t, indexExists(t, engine, idxName))
	require.Equal(t, nRows, countRowsIn(t, engine, testSubtree, ns))

	results, err := backend.Search(ctx, ns, testModel, testResource, makeEmbedding(0.5, 0.5), 5)
	require.NoError(t, err)
	assert.Len(t, results, 5)
}

func TestIntegrationPromoterSkipsSmallTenant(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const ns = "integration-test-small"
	require.NoError(t, backend.Upsert(ctx, []Vector{
		{Namespace: ns, Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/1",
			ResourceVersion: 1, Content: "only row", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.1, 0.1), Model: testModel},
	}))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	promoter := NewPromoter(database, 100, 0)
	require.NoError(t, promoter.Promote(ctx))

	idxName := partialHNSWName(testResource, ns)
	require.False(t, indexExists(t, engine, idxName),
		"small tenant should not be promoted")
}

func indexExists(t *testing.T, engine *xorm.Engine, idxName string) bool {
	t.Helper()
	var exists bool
	err := engine.DB().QueryRowContext(context.Background(), `
		SELECT EXISTS (
			SELECT 1 FROM pg_class c
			JOIN pg_index i ON i.indexrelid = c.oid
			WHERE c.relname = $1 AND c.relkind = 'i' AND i.indisvalid
		)`, idxName).Scan(&exists)
	require.NoError(t, err)
	return exists
}

func countRowsIn(t *testing.T, engine *xorm.Engine, table, ns string) int {
	t.Helper()
	var n int
	require.NoError(t, engine.DB().QueryRowContext(context.Background(),
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE namespace = $1`, table), ns).Scan(&n))
	return n
}

// makeEmbedding builds a 1024-dim halfvec with the first two values set.
func makeEmbedding(a, b float32) []float32 {
	e := make([]float32, 1024)
	e[0] = a
	e[1] = b
	return e
}

func TestEnsureResourcePartition_RejectsUnsafeResource(t *testing.T) {
	b := &pgvectorBackend{}
	for _, res := range []string{"", "Dashboards", "dash-boards", "a.b", "drop;table", "with space"} {
		require.Error(t, b.EnsureResourcePartition(context.Background(), res),
			"resource %q must be rejected", res)
	}
}

func TestIntegrationVectorEnsureResourcePartition(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)
	pg := backend.(*pgvectorBackend)

	const res = "testpartition"
	leaf := subtreeName(res)
	idx := leaf + "_metadata_idx"
	drop := func() { _, _ = engine.DB().ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS %s`, leaf)) }
	drop()
	t.Cleanup(drop)

	// Absent before creation.
	ready, err := pg.resourcePartitionReady(ctx, leaf, idx)
	require.NoError(t, err)
	require.False(t, ready)

	// Create it: partition + metadata index both present.
	require.NoError(t, backend.EnsureResourcePartition(ctx, res))
	ready, err = pg.resourcePartitionReady(ctx, leaf, idx)
	require.NoError(t, err)
	assert.True(t, ready, "leaf attached as partition and metadata index present")

	// Heals a missing index: drop it, retry must recreate it.
	_, err = engine.DB().ExecContext(ctx, fmt.Sprintf(`DROP INDEX IF EXISTS %s`, idx))
	require.NoError(t, err)
	require.NoError(t, backend.EnsureResourcePartition(ctx, res))
	ready, err = pg.resourcePartitionReady(ctx, leaf, idx)
	require.NoError(t, err)
	assert.True(t, ready, "missing index recreated on retry")

	// Idempotent: a second call (fast path) is a no-op, no error.
	require.NoError(t, backend.EnsureResourcePartition(ctx, res))
}

// TestIntegrationVectorTimestamps pins the created_at/updated_at contract:
// created_at is stamped once on insert and preserved across re-embeds, while
// updated_at advances on every upsert of the same row.
func TestIntegrationVectorTimestamps(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	v := Vector{
		Namespace: "integration-test", Resource: testResource, UID: "dash-ts", Title: "Dash",
		Subresource: "panel/1", ResourceVersion: 10, Folder: "folder-a",
		Content: "original content", Metadata: json.RawMessage(`{}`),
		Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
	}
	require.NoError(t, backend.Upsert(ctx, []Vector{v}))

	created1, updated1 := readEmbeddingTimestamps(t, engine, v.Namespace, v.Model, v.UID, v.Subresource)
	require.False(t, created1.IsZero(), "created_at must be stamped on insert")
	// Both columns default to the same transaction timestamp on insert.
	require.Equal(t, created1, updated1)

	// CURRENT_TIMESTAMP has microsecond resolution and is fixed per
	// transaction, so a short sleep guarantees a strictly greater updated_at
	// on the next upsert without flakiness.
	time.Sleep(10 * time.Millisecond)

	v.Content = "changed content"
	v.Embedding = makeEmbedding(0.6, 0.4)
	require.NoError(t, backend.Upsert(ctx, []Vector{v}))

	created2, updated2 := readEmbeddingTimestamps(t, engine, v.Namespace, v.Model, v.UID, v.Subresource)
	require.Equal(t, created1, created2, "created_at must not change on re-embed")
	require.True(t, updated2.After(updated1), "updated_at must advance on re-embed")

	require.NoError(t, backend.Delete(ctx, v.Namespace, testModel, testResource, v.UID))
}

func readEmbeddingTimestamps(t *testing.T, engine *xorm.Engine, namespace, model, uid, subresource string) (createdAt, updatedAt time.Time) {
	t.Helper()
	row := engine.DB().QueryRowContext(context.Background(),
		`SELECT created_at, updated_at FROM embeddings
			WHERE namespace = $1 AND model = $2 AND uid = $3 AND subresource = $4`,
		namespace, model, uid, subresource)
	require.NoError(t, row.Scan(&createdAt, &updatedAt))
	return createdAt, updatedAt
}

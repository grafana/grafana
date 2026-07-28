package vector

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
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
		`DELETE FROM query_embedding_cache WHERE namespace LIKE 'integration-test%'`)
	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM vector_search_rate_buckets WHERE namespace LIKE 'integration-test%'`)
	_, _ = engine.DB().ExecContext(ctx,
		`UPDATE vector_latest_rv SET latest_rv = 0 WHERE id = 1`)
	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM vector_backfill_jobs WHERE model = $1`, testModel)
}

func TestIntegrationVectorUpsertAndSearch(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	// Metadata mirrors the dashboard embed extractor's real schema:
	// scalar datasourceUid/language keys (embed/dashboard/extractor.go).
	vectors := []Vector{
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-1", Title: "CPU Dashboard", Subresource: "panel/1",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "CPU usage over time for production servers",
			Metadata:  json.RawMessage(`{"datasourceUid":"prom-1","language":"promql"}`),
			Embedding: makeEmbedding(0.9, 0.1), Model: testModel,
		},
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-1", Title: "CPU Dashboard", Subresource: "panel/2",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "Memory usage alerts dashboard",
			Metadata:  json.RawMessage(`{"datasourceUid":"prom-1","language":"promql"}`),
			Embedding: makeEmbedding(0.1, 0.9), Model: testModel,
		},
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-2", Title: "Logs Dashboard", Subresource: "panel/1",
			ResourceVersion: 20, Folder: "folder-b",
			Content:   "Log volume by service",
			Metadata:  json.RawMessage(`{"datasourceUid":"loki-1","language":"logql"}`),
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
		SearchFilter{Field: "language", Values: []string{"logql"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].UID)
}

// Metadata containment must match regardless of how the writer shaped the
// value: the dashboard embed extractor stores scalars while external
// collections store arrays, and both live in the same column.
func TestIntegrationMetadataFilterShapes(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	vectors := []Vector{
		{
			Namespace: "integration-test-shapes", Resource: testResource, UID: "scalar-dash", Title: "Scalar", Subresource: "panel/1",
			ResourceVersion: 1, Folder: "f",
			Content:   "scalar-shaped metadata like the embed extractor writes",
			Metadata:  json.RawMessage(`{"datasourceUid":"prom-1","language":"promql"}`),
			Embedding: makeEmbedding(0.9, 0.1), Model: testModel,
		},
		{
			Namespace: "integration-test-shapes", Resource: testResource, UID: "array-dash", Title: "Array", Subresource: "chunk/1",
			ResourceVersion: 1, Folder: "f",
			Content:   "array-shaped metadata like external collections write",
			Metadata:  json.RawMessage(`{"datasourceUid":["prom-1","prom-2"],"language":["promql"]}`),
			Embedding: makeEmbedding(0.8, 0.2), Model: testModel,
		},
		{
			Namespace: "integration-test-shapes", Resource: testResource, UID: "other-dash", Title: "Other", Subresource: "panel/1",
			ResourceVersion: 1, Folder: "f",
			Content:   "different datasource entirely",
			Metadata:  json.RawMessage(`{"datasourceUid":"loki-1","language":"logql"}`),
			Embedding: makeEmbedding(0.7, 0.3), Model: testModel,
		},
	}
	require.NoError(t, backend.Upsert(ctx, vectors))

	uids := func(rs []VectorSearchResult) []string {
		out := make([]string, 0, len(rs))
		for _, r := range rs {
			out = append(out, r.UID)
		}
		return out
	}

	// one value matches both storage shapes
	results, err := backend.Search(ctx, "integration-test-shapes", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "datasourceUid", Values: []string{"prom-1"}})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"scalar-dash", "array-dash"}, uids(results))

	// scalar-only match
	results, err = backend.Search(ctx, "integration-test-shapes", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "language", Values: []string{"logql"}})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"other-dash"}, uids(results))

	// array element beyond the first still matches
	results, err = backend.Search(ctx, "integration-test-shapes", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "datasourceUid", Values: []string{"prom-2"}})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"array-dash"}, uids(results))

	// multiple values are IN semantics (any-of), across shapes
	results, err = backend.Search(ctx, "integration-test-shapes", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "datasourceUid", Values: []string{"prom-1", "loki-1"}})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"scalar-dash", "array-dash", "other-dash"}, uids(results))

	// two filters AND together
	results, err = backend.Search(ctx, "integration-test-shapes", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "datasourceUid", Values: []string{"prom-1"}},
		SearchFilter{Field: "language", Values: []string{"promql"}})
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"scalar-dash", "array-dash"}, uids(results))

	// empty-values filter is skipped, not rendered as invalid SQL
	results, err = backend.Search(ctx, "integration-test-shapes", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "datasourceUid", Values: []string{}})
	require.NoError(t, err)
	assert.Len(t, results, 3)
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

	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash"}})
	require.NoError(t, err)
}

// TestIntegrationDeleteNamespace verifies a tenant wipe removes every row for a
// namespace across embeddings, query cache, rate buckets, and vector_promoted,
// while leaving other namespaces untouched.
func TestIntegrationDeleteNamespace(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const nsA = "integration-test-a"
	const nsB = "integration-test-b"

	cache := backend.(QueryEmbeddingCache)
	limiter := backend.(RateLimiter)

	seed := func(ns string) {
		require.NoError(t, backend.Upsert(ctx, []Vector{
			{Namespace: ns, Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/1",
				ResourceVersion: 10, Content: "content", Metadata: json.RawMessage(`{}`),
				Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		}))
		require.NoError(t, cache.Put(ctx, ns, testModel, fmt.Sprintf("%064d", 1), makeEmbedding(0.5, 0.5)))
		_, _, err := limiter.Allow(ctx, ns, time.Minute, 100)
		require.NoError(t, err)
		_, err = engine.DB().ExecContext(ctx,
			`INSERT INTO vector_promoted (namespace, resource) VALUES ($1, $2)`, ns, testResource)
		require.NoError(t, err)
	}
	seed(nsA)
	seed(nsB)

	deleted, err := backend.DeleteNamespace(ctx, nsA)
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted, "one embedding row removed for nsA")

	// nsA gone from every table.
	existsA, err := backend.Exists(ctx, nsA, testModel, testResource, "dash")
	require.NoError(t, err)
	assert.False(t, existsA, "nsA embeddings should be gone")

	countA, err := cache.Count(ctx, nsA)
	require.NoError(t, err)
	assert.Equal(t, int64(0), countA, "nsA query cache should be gone")

	assert.Equal(t, 0, rawCount(t, engine, `SELECT count(*) FROM vector_search_rate_buckets WHERE namespace = $1`, nsA))
	assert.Equal(t, 0, rawCount(t, engine, `SELECT count(*) FROM vector_promoted WHERE namespace = $1`, nsA))

	// nsB untouched.
	existsB, err := backend.Exists(ctx, nsB, testModel, testResource, "dash")
	require.NoError(t, err)
	assert.True(t, existsB, "nsB embeddings should survive")

	countB, err := cache.Count(ctx, nsB)
	require.NoError(t, err)
	assert.Equal(t, int64(1), countB, "nsB query cache should survive")

	assert.Equal(t, 1, rawCount(t, engine, `SELECT count(*) FROM vector_search_rate_buckets WHERE namespace = $1`, nsB))
	assert.Equal(t, 1, rawCount(t, engine, `SELECT count(*) FROM vector_promoted WHERE namespace = $1`, nsB))
}

func rawCount(t *testing.T, engine *xorm.Engine, query string, args ...any) int {
	t.Helper()
	var n int
	require.NoError(t, engine.DB().QueryRowContext(context.Background(), query, args...).Scan(&n))
	return n
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
	}, nil, []string{"panel/1", "panel/4"})
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

	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash-a"}})
	require.NoError(t, err)
	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash-b"}})
	require.NoError(t, err)
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
		nil,
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

	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash"}})
	require.NoError(t, err)
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
		nil, nil, []string{"panel/1"}))

	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "p1"}, stored)

	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash"}})
	require.NoError(t, err)
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

	require.NoError(t, backend.UpsertReplaceSubresources(ctx, "integration-test", testModel, testResource, "dash", nil, nil, nil))

	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "untouched"}, stored)

	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash"}})
	require.NoError(t, err)
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
	}, nil, []string{"panel/1", "panel/2"})
	require.Error(t, err)

	// State is unchanged: panel/1 still has v1 content, panel/2 still present.
	stored, _, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "v1", "panel/2": "v1"}, stored,
		"failed batch leaves no half-applied state")

	_, _, err = backend.DeleteRows(ctx, "integration-test", testModel, testResource, DeleteSelector{UIDs: []string{"dash"}})
	require.NoError(t, err)
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

	_, _, err := backend.DeleteRows(ctx, v.Namespace, testModel, testResource, DeleteSelector{UIDs: []string{v.UID}})
	require.NoError(t, err)
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

func TestIntegrationVectorCollectionCatalog(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	// The migration seeds the dashboards row.
	c, found, err := backend.ResolveCollection(ctx, "dashboard.grafana.app", "dashboards")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, "dashboards", c.PartitionKey)
	assert.False(t, c.IsExternal)

	// Unknown pair: not found, no error.
	_, found, err = backend.ResolveCollection(ctx, "nope.grafana.app", "nope")
	require.NoError(t, err)
	assert.False(t, found)

	// Insert an external collection whose resource name is not a valid SQL
	// identifier — the catalog decouples resource names from partition keys.
	_, err = engine.DB().ExecContext(ctx, `
		INSERT INTO embedding_collections (group_name, resource, partition_key, is_external)
		VALUES ('ext.example.com', 'my-things', 'my_things', true)
		ON CONFLICT DO NOTHING`)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.DB().ExecContext(context.Background(),
			`DELETE FROM embedding_collections WHERE group_name = 'ext.example.com'`)
	})

	c, found, err = backend.ResolveCollection(ctx, "ext.example.com", "my-things")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, "my_things", c.PartitionKey)
	assert.True(t, c.IsExternal)

	// validateResource rides the catalog: operations on an unprovisioned
	// partition key are rejected before touching the embeddings table.
	_, err = backend.Search(ctx, "ns", testModel, "not-provisioned", make([]float32, 3), 5)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported resource")
}

func TestIntegrationVectorMetadataOnlyRefresh(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	orig := Vector{
		Namespace: "ns-meta", Resource: testResource, UID: "meta-uid",
		Title: "Before", Subresource: "chunk/1", Content: "hello",
		Metadata: json.RawMessage(`{"embeddedAt":1}`), Embedding: makeEmbedding(0.1, 0.1), Model: testModel,
	}
	require.NoError(t, backend.Upsert(ctx, []Vector{orig}))
	// (test lives in package vector, so Vector/VectorMeta are unqualified)

	// metadataOnly rewrite: title+metadata change, embedding and content stay.
	err := backend.UpsertReplaceSubresources(ctx, "ns-meta", testModel, testResource, "meta-uid",
		nil,
		[]VectorMeta{{Subresource: "chunk/1", Title: "After", Metadata: json.RawMessage(`{"embeddedAt":2}`)}},
		[]string{"chunk/1"})
	require.NoError(t, err)

	content, _, err := backend.GetSubresourceContent(ctx, "ns-meta", testModel, testResource, "meta-uid")
	require.NoError(t, err)
	require.Equal(t, map[string]string{"chunk/1": "hello"}, content, "content untouched")

	// Row-level check: title/metadata updated, embedding unchanged.
	rows, err := backend.Search(ctx, "ns-meta", testModel, testResource, makeEmbedding(0.1, 0.1), 5)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "After", rows[0].Title)
	require.JSONEq(t, `{"embeddedAt":2}`, string(rows[0].Metadata))
}

func TestIntegrationVectorDeleteRows(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	mk := func(uid, sub string) Vector {
		return Vector{
			Namespace: "ns-del", Resource: testResource, UID: uid, Title: "T",
			Subresource: sub, Content: "c", Embedding: makeEmbedding(0.2, 0.2), Model: testModel,
		}
	}
	require.NoError(t, backend.Upsert(ctx, []Vector{
		mk("u1", ""), mk("u1", "chunk/1"), mk("u2", ""), mk("u3", ""),
	}))

	// UIDs selector: whole entities including subresources.
	n, more, err := backend.DeleteRows(ctx, "ns-del", testModel, testResource, DeleteSelector{UIDs: []string{"u1", "u2"}})
	require.NoError(t, err)
	require.False(t, more)
	require.EqualValues(t, 3, n)

	// All selector with tiny page to exercise hasMore.
	require.NoError(t, backend.Upsert(ctx, []Vector{mk("u4", ""), mk("u5", "")}))
	n, more, err = backend.DeleteRows(ctx, "ns-del", testModel, testResource, DeleteSelector{All: true, Limit: 2})
	require.NoError(t, err)
	require.EqualValues(t, 2, n)
	require.True(t, more) // u3 remains
	n, more, err = backend.DeleteRows(ctx, "ns-del", testModel, testResource, DeleteSelector{All: true, Limit: 2})
	require.NoError(t, err)
	require.EqualValues(t, 1, n)
	require.False(t, more)

	// Selector validation.
	_, _, err = backend.DeleteRows(ctx, "ns-del", testModel, testResource, DeleteSelector{})
	require.Error(t, err)
	_, _, err = backend.DeleteRows(ctx, "ns-del", testModel, testResource, DeleteSelector{UIDs: []string{"x"}, All: true})
	require.Error(t, err)
}

func TestIntegrationEnsureCollection(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)
	t.Cleanup(func() {
		_, _ = engine.DB().ExecContext(context.Background(),
			`DELETE FROM embedding_collections WHERE group_name = 'prov.example.com'`)
		_, _ = engine.DB().ExecContext(context.Background(), `DROP TABLE IF EXISTS embeddings_prov_things_external`)
	})

	// First call provisions: catalog row + partition + GIN index.
	c, err := backend.EnsureCollection(ctx, "prov.example.com", "prov-things", true)
	require.NoError(t, err)
	require.Equal(t, "prov_things_external", c.PartitionKey)
	require.True(t, c.IsExternal)

	var ready bool
	require.NoError(t, engine.DB().QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_inherits i
			JOIN pg_class c ON c.oid = i.inhrelid
			JOIN pg_class p ON p.oid = i.inhparent
			WHERE p.relname = 'embeddings' AND c.relname = 'embeddings_prov_things_external'
		) AND EXISTS (
			SELECT 1 FROM pg_class WHERE relname = 'embeddings_prov_things_external_metadata_idx' AND relkind = 'i'
		)`).Scan(&ready))
	require.True(t, ready, "partition leaf + GIN index exist")

	// Idempotent.
	c2, err := backend.EnsureCollection(ctx, "prov.example.com", "prov-things", true)
	require.NoError(t, err)
	require.Equal(t, c, c2)

	// Writes to the new collection work end-to-end.
	require.NoError(t, backend.Upsert(ctx, []Vector{{
		Namespace: "ns-prov", Resource: c.PartitionKey, UID: "u1", Title: "T",
		Content: "c", Embedding: makeEmbedding(0.3, 0.3), Model: testModel,
	}}))

	// Over-long resource names are rejected before any DB write.
	_, err = backend.EnsureCollection(ctx, "prov.example.com", strings.Repeat("x", 60), true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "too long")

	// Concurrent provisioning converges on one row.
	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = backend.EnsureCollection(ctx, "prov.example.com", "prov-race", true)
		}(i)
	}
	wg.Wait()
	for _, e := range errs {
		require.NoError(t, e)
	}
	var n int
	require.NoError(t, engine.DB().QueryRowContext(ctx,
		`SELECT count(*) FROM embedding_collections WHERE group_name = 'prov.example.com' AND resource = 'prov-race'`).Scan(&n))
	require.Equal(t, 1, n)
	t.Cleanup(func() {
		_, _ = engine.DB().ExecContext(context.Background(), `DROP TABLE IF EXISTS embeddings_prov_race_external`)
	})
}

func TestIntegrationWithEntityLock(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	var order []string
	var mu sync.Mutex
	record := func(s string) { mu.Lock(); order = append(order, s); mu.Unlock() }

	firstInside := make(chan struct{})
	release := make(chan struct{})
	done := make(chan struct{})

	go func() {
		_ = backend.WithEntityLock(ctx, "ns-lock", testResource, "u-lock", func(context.Context) error {
			record("first-in")
			close(firstInside)
			<-release
			record("first-out")
			return nil
		})
		close(done)
	}()

	<-firstInside
	second := make(chan struct{})
	go func() {
		_ = backend.WithEntityLock(ctx, "ns-lock", testResource, "u-lock", func(context.Context) error {
			record("second-in")
			return nil
		})
		close(second)
	}()

	// Second must not enter while first holds the lock.
	select {
	case <-second:
		t.Fatal("second acquired lock while first held it")
	case <-time.After(300 * time.Millisecond):
	}

	close(release)
	<-done
	<-second
	require.Equal(t, []string{"first-in", "first-out", "second-in"}, order)

	// Different entity does not contend.
	err := backend.WithEntityLock(ctx, "ns-lock", testResource, "other-uid", func(context.Context) error { return nil })
	require.NoError(t, err)
}

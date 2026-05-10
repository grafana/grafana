package backfill

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// minimalDashboardJSON returns a small dashboard payload the dashboard
// extractor will turn into a single panel item.
func minimalDashboardJSON(uid, title string) []byte {
	body, _ := json.Marshal(map[string]any{
		"uid":   uid,
		"title": title,
		"panels": []any{
			map[string]any{
				"id":          1,
				"title":       "CPU",
				"description": "CPU usage",
			},
		},
	})
	return body
}

// makeListItem packages a minimal dashboard JSON into a listItem with the
// given namespace, name, and RV.
func makeListItem(ns, name string, rv int64) listItem {
	return listItem{
		Namespace: ns,
		Name:      name,
		RV:        rv,
		Value:     minimalDashboardJSON(name, name+"-title"),
	}
}

func newBackfiller(t *testing.T, storage *fakeStorage, vec *fakeVector) *VectorBackfiller {
	t.Helper()
	emb := newFakeEmbedder(&fakeText{dim: 4})
	b, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		Embedder:      emb,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
	})
	require.NoError(t, err)
	return b
}

func TestRunBackfill_NoIncompleteJobs_NoOp(t *testing.T) {
	vec := newFakeVector()
	o := newBackfiller(t, newFakeStorage(), vec)
	o.runBackfill(context.Background())
	assert.Empty(t, vec.checkpoints)
	assert.Empty(t, vec.completedJobIDs)
}

func TestRun_LockUnavailable_SkipsAllWork(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "a", 1)}

	vec := newFakeVector()
	vec.lockUnavailable = true
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", StoppingRV: 100,
	}}

	o := newBackfiller(t, storage, vec)
	require.NoError(t, o.Run(context.Background()))

	assert.Equal(t, 1, vec.lockAttempts, "should attempt to acquire the lock")
	assert.Equal(t, 0, vec.lockReleases, "should not release a lock it didn't acquire")
	assert.Empty(t, vec.checkpoints, "no work should happen without the lock")
	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.completedJobIDs)
}

func TestRun_LockAcquired_ReleasedOnReturn(t *testing.T) {
	vec := newFakeVector()
	o := newBackfiller(t, newFakeStorage(), vec)
	require.NoError(t, o.Run(context.Background()))

	assert.Equal(t, 1, vec.lockAttempts)
	assert.Equal(t, 1, vec.lockReleases, "lock must be released when Run returns")
}

func TestRunBackfillJob_HappyPath_EmbedsAndCompletes(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns-1", "dash-a", 50),
		makeListItem("ns-1", "dash-b", 60),
		makeListItem("ns-2", "dash-c", 70),
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 42, Model: "test-model", StoppingRV: 100,
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 3, "one upsert per dashboard")
	require.Len(t, vec.completedJobIDs, 1)
	assert.Equal(t, int64(42), vec.completedJobIDs[0])

	// Checkpoint is deferred by one item: each item's continue token is
	// only persisted after the next Next()==true confirms its peek was
	// valid. The final item's token is never confirmed (iterator is
	// exhausted), so we get N-1 checkpoints for N items.
	require.Len(t, vec.checkpoints, 2)
	for _, c := range vec.checkpoints {
		assert.Empty(t, c.LastError, "happy path leaves last_error empty")
	}
}

func TestRunBackfillJob_SkipsExistingEmbeddings(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns-1", "dash-a", 50),
		makeListItem("ns-1", "dash-b", 60),
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", StoppingRV: 100,
	}}
	// dash-a already has an embedding — backfill should skip it.
	vec.markExists("ns-1", "test-model", "dashboards", "dash-a")

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "only the missing dashboard is embedded")
	v := vec.upserts[0][0]
	assert.Equal(t, "dash-b", v.UID)
}

func TestRunBackfillJob_SkipsItemsAboveStoppingRV(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns", "old", 50),
		makeListItem("ns", "new", 999), // RV > stopping_rv
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", StoppingRV: 100,
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "items past stopping_rv belong to the live worker")
	assert.Equal(t, "old", vec.upserts[0][0].UID)
}

func TestRunBackfillJob_ResumesFromLastSeenKey(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns", "a", 1),
		makeListItem("ns", "b", 2),
		makeListItem("ns", "c", 3),
	}

	vec := newFakeVector()
	// Pretend a previous run already processed items 0 + 1 ("a" and "b") and
	// checkpointed at "tok-2" (start at the third item) for the dashboards
	// builder.
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", StoppingRV: 100,
		LastSeenKey: encodeCursor("dashboards", "tok-2"),
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "resume should only embed the remaining item")
	assert.Equal(t, "c", vec.upserts[0][0].UID)
	require.Len(t, vec.completedJobIDs, 1)
}

func TestRunBackfillJob_CursorForUnknownResource_StartsFromScratch(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns", "a", 1),
		makeListItem("ns", "b", 2),
	}

	vec := newFakeVector()
	// Cursor refers to a Builder that's no longer registered. The
	// backfiller should ignore the cursor (not blindly trust the token
	// against the wrong keyspace) and run every registered Builder
	// from the beginning.
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", StoppingRV: 100,
		LastSeenKey: encodeCursor("removed-resource", "tok-9999"),
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 2, "every dashboard should be embedded after cursor is ignored")
	require.Len(t, vec.completedJobIDs, 1)
}

// A job pinned to a resource this instance doesn't know about almost
// certainly belongs to another instance configured with a different set of
// Builders. Leaving it untouched (no upserts, no complete, no error stamp)
// lets the right instance drain it.
func TestRunBackfillJob_TargetedUnknownResource_LeftUntouched(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "a", 1)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", Resource: "folders", StoppingRV: 100,
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts, "no builder for the targeted resource → no embeddings")
	assert.Empty(t, vec.completedJobIDs, "another instance may own this resource; do not complete it")
	assert.Empty(t, vec.errorMarks, "no error path on a deliberate skip")
	assert.Empty(t, vec.checkpoints)
}

func TestRunBackfillJob_MalformedCursor_StartsFromScratch(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "a", 1)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "test-model", StoppingRV: 100,
		LastSeenKey: "not-json-at-all",
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "malformed cursor → start fresh, embed everything")
	require.Len(t, vec.completedJobIDs, 1)
}

// Jobs targeting a different model belong to another instance; the SQL
// list query filters them server-side so this backfiller never sees them.
// The fake mirrors that behavior — we assert nothing happens, in particular
// that last_error is not stamped on a row another instance owns.
func TestRunBackfillJob_DifferentModel_IgnoredCompletely(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "a", 1)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 1, Model: "some-other-instances-model", StoppingRV: 100,
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.completedJobIDs, "another instance owns this job; do not complete it")
	assert.Empty(t, vec.checkpoints)
	assert.Empty(t, vec.errorMarks, "model mismatch must not pollute another instance's last_error")
}

func TestRunBackfillJob_PaginatedAcrossPages(t *testing.T) {
	// Build a result set one page + 5 items long so the backfiller must
	// fetch exactly two pages.
	const total = backfillPageSize + 5

	storage := newFakeStorage()
	storage.listItems = make([]listItem, total)
	for i := range storage.listItems {
		storage.listItems[i] = makeListItem("ns", uniqName(i), int64(i+1))
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 7, Model: "test-model", StoppingRV: int64(total + 100),
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Len(t, vec.upserts, total, "every item across all pages is embedded")
	require.Len(t, vec.completedJobIDs, 1)
	// assert pagination
	require.Len(t, storage.listCalls, 2, "backfiller must request two pages")
	assert.Empty(t, storage.listCalls[0], "first page starts with an empty token")
	assert.NotEmpty(t, storage.listCalls[1], "second page must resume from a continue token")
}

// TestRunBackfillJob_ExactPageMultiple exercises the boundary where total
// item count is exactly N * backfillPageSize. A naive implementation would
// emit a continue token built from the post-last-item peek (Name="") and
// re-feed it through ListIterator on the next page call, which the kv
// backend rejects with "name is required". The fix defers the per-item
// checkpoint by one Next()==true so the last item of a page is only
// persisted after a confirming peek.
func TestRunBackfillJob_ExactPageMultiple(t *testing.T) {
	const total = backfillPageSize

	storage := newFakeStorage()
	storage.listItems = make([]listItem, total)
	for i := range storage.listItems {
		storage.listItems[i] = makeListItem("ns", uniqName(i), int64(i+1))
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{
		ID: 9, Model: "test-model", StoppingRV: int64(total + 100),
	}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Len(t, vec.upserts, total, "every item is embedded")
	require.Len(t, vec.completedJobIDs, 1, "job completes despite hitting the page boundary")
	assert.Empty(t, vec.errorMarks, "no error path on a clean exact-page run")
	// Final item's continue token is never confirmed by a follow-up
	// Next()==true, so we persist N-1 checkpoints, never the broken one.
	require.Len(t, vec.checkpoints, total-1)
}

func uniqName(i int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz"
	out := []byte{letters[i%26], letters[(i/26)%26]}
	if i >= 26*26 {
		out = append(out, letters[(i/(26*26))%26])
	}
	return string(out)
}

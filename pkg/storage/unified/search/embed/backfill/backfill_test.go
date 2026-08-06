package backfill

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/aws/smithy-go"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/openai/openai-go/v3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
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

// dashboardJSONWithFolder is minimalDashboardJSON annotated with a folder UID.
func dashboardJSONWithFolder(uid, title, folderUID string) []byte {
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
		"metadata": map[string]any{
			"annotations": map[string]any{
				"grafana.app/folder": folderUID,
			},
		},
	})
	return body
}

// makeListItemWithFolder is makeListItem plus a folder annotation.
func makeListItemWithFolder(ns, name string, rv int64, folderUID string) listItem {
	return listItem{
		Namespace: ns,
		Name:      name,
		RV:        rv,
		Value:     dashboardJSONWithFolder(name, name+"-title", folderUID),
	}
}

// seedFolder makes a folder resource readable by fakeStorage.ReadResource so
// FolderTitleResolver.Title can resolve it.
func (f *fakeStorage) seedFolder(ns, uid, title string) {
	value, _ := json.Marshal(map[string]any{"spec": map[string]any{"title": title}})
	f.resources[storeKey(ns, "folder.grafana.app", "folders", uid)] = storedResource{Value: value}
}

func newBackfiller(t *testing.T, storage *fakeStorage, vec *fakeVector) *VectorBackfiller {
	t.Helper()
	return newBackfillerWithBuilders(t, storage, vec, dashboard.New())
}

// newBackfillerWithBuilders lets version-aware tests swap in a builder that
// reports a different Version() than the real dashboard extractor.
func newBackfillerWithBuilders(t *testing.T, storage *fakeStorage, vec *fakeVector, builders ...embed.Builder) *VectorBackfiller {
	t.Helper()
	emb := newFakeEmbedder(&fakeText{dim: 4})
	b, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      builders,
	})
	require.NoError(t, err)
	return b
}

// versionedBuilder wraps a real Builder but reports a different Version(),
// so tests can simulate an extractor content-shape bump without a second
// real extractor implementation.
type versionedBuilder struct {
	embed.Builder
	version int
}

func (v versionedBuilder) Version() int { return v.version }

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

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- o.Run(ctx) }()

	// Run loops on a ticker; wait for the lock, then stop it.
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return vec.lockAttempts == 1
	}, time.Second, time.Millisecond)
	cancel()
	require.ErrorIs(t, <-done, context.Canceled)

	assert.Equal(t, 1, vec.lockReleases, "lock must be released when Run returns")
}

// TestBackfill_ObservesItemDuration verifies the per-item histogram
// fires when an item is processed. A regression here would mean the
// wiring between processBackfillItem and VectorMetrics is broken.
func TestBackfill_ObservesItemDuration(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := resource.ProvideVectorMetrics(reg)

	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns-1", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	emb := newFakeEmbedder(&fakeText{dim: 4})
	b, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
		Metrics:       m,
	})
	require.NoError(t, err)

	b.runBackfill(context.Background())

	// One successful observation under the (group, resource, status) labels
	// the production code uses.
	require.Equal(t, 1, testutil.CollectAndCount(m.BackfillItemDuration, "vector_storage_backfill_item_duration_seconds"))
}

// TestRunBackfillJob_FolderTitle_PrefixesBreadcrumb covers the wiring: the
// backfiller resolves the folder title via storage and passes it to Extract,
// which prefixes the breadcrumb.
func TestRunBackfillJob_FolderTitle_PrefixesBreadcrumb(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItemWithFolder("ns-1", "dash-a", 50, "folder-uid")}
	storage.seedFolder("ns-1", "folder-uid", "Production")

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1)
	require.NotEmpty(t, vec.upserts[0])
	assert.Contains(t, vec.upserts[0][0].Content, "Production → dash-a-title")
}

// TestRunBackfillJob_FolderTitleCache_ScopedToJobRun covers the per-job-run
// cache: two dashboards sharing a folder within one job run resolve it once.
func TestRunBackfillJob_FolderTitleCache_ScopedToJobRun(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItemWithFolder("ns-1", "dash-a", 50, "folder-uid"),
		makeListItemWithFolder("ns-1", "dash-b", 60, "folder-uid"),
	}
	storage.seedFolder("ns-1", "folder-uid", "Production")

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 2)
	assert.Contains(t, vec.upserts[0][0].Content, "Production →")
	assert.Contains(t, vec.upserts[1][0].Content, "Production →")
	assert.Len(t, o.folderTitleCache, 1, "one cache entry shared across both dashboards in the same folder")
	assert.Equal(t, "Production", o.folderTitleCache["ns-1/folder-uid"])
}

// TestRunBackfillJob_FolderTitleResolveError_FailsJob covers the retry
// contract: a folder-title storage error is a transient item error, so the
// whole job is marked errored for the next tick — not skipped like a
// deterministic Extract failure.
func TestRunBackfillJob_FolderTitleResolveError_FailsJob(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItemWithFolder("ns-1", "dash-a", 50, "folder-uid")}
	storage.readErr = errors.New("connection refused")

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts)
	require.Len(t, vec.errorMarks, 1, "resolver error must fail the job for retry, not skip the item")
	assert.Empty(t, vec.completedJobIDs)
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

func TestRunBackfillJob_StampsBuilderVersion(t *testing.T) {
	// Upserted vectors carry the builder's content-format version, not
	// whatever the RV or an arbitrary literal happens to be.
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns-1", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1)
	require.NotEmpty(t, vec.upserts[0])
	for _, v := range vec.upserts[0] {
		assert.Equal(t, dashboard.New().Version(), v.ContentVersion)
	}
}

// TestRunBackfillJob_VersionBump_ReEmbedsAtNewVersion covers the incremental
// re-embed case: a uid embedded under an older extractor version is not
// skipped, and the rewritten rows carry the current builder version.
func TestRunBackfillJob_VersionBump_ReEmbedsAtNewVersion(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 1, "panel/1")

	builder := versionedBuilder{dashboard.New(), 2}
	o := newBackfillerWithBuilders(t, storage, vec, builder)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "version bump must re-embed, not skip")
	for _, v := range vec.upserts[0] {
		assert.Equal(t, 2, v.ContentVersion, "re-embedded rows carry the builder's current version")
	}
}

// TestRunBackfillJob_SameVersion_Skips is the ContentVersion analogue of the
// old Exists-based skip: a uid already at the builder's version is left alone.
func TestRunBackfillJob_SameVersion_Skips(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 2, "panel/1")

	builder := versionedBuilder{dashboard.New(), 2}
	o := newBackfillerWithBuilders(t, storage, vec, builder)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts, "same version must skip re-embedding")
}

// TestRunBackfillJob_StoredVersionAheadOfBuilder_Skips covers a builder
// rollback: stored rows are ahead of the (rolled-back) builder version. The
// >= rule in the skip check means this still counts as already embedded.
func TestRunBackfillJob_StoredVersionAheadOfBuilder_Skips(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 3, "panel/1")

	builder := versionedBuilder{dashboard.New(), 2}
	o := newBackfillerWithBuilders(t, storage, vec, builder)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts, "stored version ahead of the builder must still skip")
}

// TestRunBackfillJob_ReEmbedDropsStalePanel_DeletesStaleSubresource proves
// the backfiller's write path uses UpsertReplaceSubresources (not a plain
// Upsert): when a re-embed's extractor output no longer includes a panel
// that was previously stored, that stale row is gone afterward.
func TestRunBackfillJob_ReEmbedDropsStalePanel_DeletesStaleSubresource(t *testing.T) {
	storage := newFakeStorage()
	// minimalDashboardJSON only ever emits panel/1; panel/2 below is stale
	// content left over from a previous version of this dashboard.
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 1, "panel/1", "panel/2")

	builder := versionedBuilder{dashboard.New(), 2}
	o := newBackfillerWithBuilders(t, storage, vec, builder)
	o.runBackfill(context.Background())

	require.Len(t, vec.replaceCalls, 1)
	assert.Equal(t, []string{"panel/1"}, vec.replaceCalls[0].Desired, "extractor no longer emits panel/2")

	_, stillThere := vec.rows[rowsKey("ns", "test-model", "dashboards", "dash-a")]["panel/2"]
	assert.False(t, stillThere, "stale subresource row must be gone after the replace")
}

// extractDashboardItems runs the real dashboard extractor so tests can seed
// a fakeVector with ground-truth content instead of guessing the breadcrumb
// string by hand.
func extractDashboardItems(t *testing.T, ns, name string, value []byte, folderTitle string) []embed.Item {
	t.Helper()
	key := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: ns, Name: name}
	items, err := dashboard.New().Extract(context.Background(), key, value, folderTitle)
	require.NoError(t, err)
	return items
}

// TestRunBackfillJob_VersionStale_IdenticalContent_SkipsEmbedAndTouchesVersion
// covers the version-bump short-circuit this task adds: a root-folder
// dashboard's v1 and v2 extracted content are byte-identical (root-folder
// dashboards have no folder title to prefix onto the breadcrumb), so the
// backfiller must not pay a provider call — it just stamps the row at the
// builder's current version.
// The identical-content path adds two new failure modes; both must be item
// errors that fail the job (retry path), never silent skips — a swallowed
// UpdateContentVersion error would leave the uid version-stale and rescanned
// on every tick forever.
// A concurrent edit must not lose its embeddings to a stale empty-extract delete.
func TestRunBackfillJob_EmptyExtractDelete_GuardedByLiveRV(t *testing.T) {
	storage := newFakeStorage()
	// Scanned snapshot (RV 50) has no embeddable panels; the live resource
	// has moved on (RV 60) — the reconciler owns the newer revision.
	body, _ := json.Marshal(map[string]any{"uid": "dash-a", "title": "empty"})
	storage.listItems = []listItem{{Namespace: "ns", Name: "dash-a", RV: 50, Value: body}}
	storage.resources[storeKey("ns", "dashboard.grafana.app", "dashboards", "dash-a")] = storedResource{
		Value: minimalDashboardJSON("dash-a", "dash-a-title"), RV: 60,
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 1, "panel/1")

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.deletes, "stale empty extract must not delete the newer revision's rows")
}

// A dashboard deleted after the scan must not be re-created from the stale snapshot.
func TestRunBackfillJob_DeletedSinceScan_SkipsWrite(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}
	storage.markNotFound("ns", "dashboard.grafana.app", "dashboards", "dash-a")

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts, "deleted dashboard must not be re-embedded")
	assert.Empty(t, vec.replaceCalls)
	require.Len(t, vec.completedJobIDs, 1)
}

// A transient live-read failure retries the item instead of writing stale content.
func TestRunBackfillJob_LiveReadError_FailsJob(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}
	storage.readErr = errors.New("storage flake")

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.replaceCalls)
	require.Len(t, vec.errorMarks, 1, "read failure must mark the job errored for retry")
	assert.Empty(t, vec.completedJobIDs)
}

// A concurrent edit between scan and write must not be overwritten with stale content.
func TestRunBackfillJob_RVChangedSinceScan_SkipsWrite(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}
	// Live resource has moved past the scanned RV (a concurrent edit).
	storage.resources[storeKey("ns", "dashboard.grafana.app", "dashboards", "dash-a")] = storedResource{
		Value: minimalDashboardJSON("dash-a", "dash-a-title"), RV: 60,
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts, "stale scan must not overwrite the newer revision")
	assert.Empty(t, vec.replaceCalls)
	require.Len(t, vec.completedJobIDs, 1, "skip is per-item; the job still completes")
}

// A version-stale uid whose new extractor output is empty sheds its old rows.
func TestRunBackfillJob_VersionStale_EmptyExtract_DeletesOldRows(t *testing.T) {
	storage := newFakeStorage()
	// Dashboard JSON with no panels: extractor produces zero items.
	body, _ := json.Marshal(map[string]any{"uid": "dash-a", "title": "empty"})
	storage.listItems = []listItem{{Namespace: "ns", Name: "dash-a", RV: 50, Value: body}}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 1, "panel/1")

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.deletes, 1, "stale rows must be deleted when the new extract is empty")
	assert.Equal(t, "dash-a", vec.deletes[0].UID)
	assert.Empty(t, vec.upserts)
}

// A never-embedded uid with an empty extract keeps the plain skip (nothing to delete).
func TestRunBackfillJob_Fresh_EmptyExtract_StillSkips(t *testing.T) {
	storage := newFakeStorage()
	body, _ := json.Marshal(map[string]any{"uid": "dash-a", "title": "empty"})
	storage.listItems = []listItem{{Namespace: "ns", Name: "dash-a", RV: 50, Value: body}}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.deletes)
	assert.Empty(t, vec.upserts)
}

func TestRunBackfillJob_GetSubresourceContentError_FailsJob(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dash-a", 1, "panel/1")
	vec.getContentErr = errors.New("pg connection reset")

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.errorMarks, 1, "stored-content read failure must mark the job errored")
	assert.Empty(t, vec.completedJobIDs, "job must not complete on the same tick")
	assert.Empty(t, vec.updateCalls)
	assert.Empty(t, vec.upserts)
}

func TestRunBackfillJob_UpdateContentVersionError_FailsJob(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	items := extractDashboardItems(t, "ns", "dash-a", minimalDashboardJSON("dash-a", "dash-a-title"), "")
	require.Len(t, items, 1)

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedStoredContent("ns", "test-model", "dashboards", "dash-a", items[0].Subresource, items[0].Content, 1)
	vec.updateErr = errors.New("pg connection reset")

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.errorMarks, 1, "version-stamp failure must mark the job errored, not skip silently")
	assert.Empty(t, vec.completedJobIDs)
	assert.Empty(t, vec.upserts, "identical content must still not re-embed on the error path")
}

func TestRunBackfillJob_VersionStale_IdenticalContent_SkipsEmbedAndTouchesVersion(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	items := extractDashboardItems(t, "ns", "dash-a", minimalDashboardJSON("dash-a", "dash-a-title"), "")
	require.Len(t, items, 1)

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	// Job already at the builder's current version, so ReopenStaleBackfillJobs
	// doesn't reset stopping_rv/cursor out from under this test.
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	// Stored row is at content_version 1 (stale) but its content is exactly
	// what the current (v2) extractor produces for this root-folder dashboard.
	vec.seedStoredContent("ns", "test-model", "dashboards", "dash-a", items[0].Subresource, items[0].Content, 1)

	reg := prometheus.NewPedanticRegistry()
	m := resource.ProvideVectorMetrics(reg)
	text := &fakeText{dim: 4}
	emb := newFakeEmbedder(text)
	o, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
		Metrics:       m,
	})
	require.NoError(t, err)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts, "identical content must not be re-embedded")
	assert.Empty(t, vec.replaceCalls)
	assert.Equal(t, 0, text.calls, "embedder must not be called when content is identical")
	require.Len(t, vec.updateCalls, 1)
	assert.Equal(t, updateCall{"ns", "test-model", "dashboards", "dash-a", dashboard.New().Version()}, vec.updateCalls[0])
	require.Len(t, vec.completedJobIDs, 1)

	var got dto.Metric
	obs := m.BackfillItemDuration.WithLabelValues("dashboard.grafana.app", "dashboards", "skipped_identical_content")
	require.NoError(t, obs.(prometheus.Metric).Write(&got))
	assert.Equal(t, uint64(1), got.GetHistogram().GetSampleCount(), "the skipped_identical_content status label must be observed")
}

// TestRunBackfillJob_VersionStale_FolderedDashboard_ContentDiffers_FullReEmbed
// covers the case the identity check must NOT short-circuit: a foldered
// dashboard's v2 content gets the folder-title breadcrumb prefix, so it
// differs from the stored v1 content and the full re-embed path still runs.
func TestRunBackfillJob_VersionStale_FolderedDashboard_ContentDiffers_FullReEmbed(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItemWithFolder("ns", "dash-a", 50, "folder-uid")}
	storage.seedFolder("ns", "folder-uid", "Production")

	// Simulate the old (pre-breadcrumb) v1 shape: extracted with an empty
	// folder title, so it lacks the prefix the live run will add via the
	// real folder title resolved above.
	oldItems := extractDashboardItems(t, "ns", "dash-a", dashboardJSONWithFolder("dash-a", "dash-a-title", "folder-uid"), "")
	require.Len(t, oldItems, 1)

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedStoredContent("ns", "test-model", "dashboards", "dash-a", oldItems[0].Subresource, oldItems[0].Content, 1)

	text := &fakeText{dim: 4}
	emb := newFakeEmbedder(text)
	o, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
	})
	require.NoError(t, err)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "folder-title prefix makes the content differ, so the full re-embed path must run")
	assert.Equal(t, 1, text.calls, "embedder must be called on the full re-embed path")
	assert.Empty(t, vec.updateCalls, "content differs, so UpdateContentVersion must not be called")
	for _, v := range vec.upserts[0] {
		assert.Equal(t, dashboard.New().Version(), v.ContentVersion)
	}
	require.Len(t, vec.completedJobIDs, 1)
}

// TestRunBackfillJob_VersionStale_SubresourceSetDiffers_FullReEmbed covers
// the other non-identical case: the surviving panel's content is unchanged,
// but a stored panel no longer exists in the extractor's output (e.g. a
// deleted panel). The key-set mismatch alone must force the full path.
func TestRunBackfillJob_VersionStale_SubresourceSetDiffers_FullReEmbed(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	items := extractDashboardItems(t, "ns", "dash-a", minimalDashboardJSON("dash-a", "dash-a-title"), "")
	require.Len(t, items, 1)

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedStoredContent("ns", "test-model", "dashboards", "dash-a", items[0].Subresource, items[0].Content, 1)
	// panel/2 is stale content the extractor no longer produces (e.g. a
	// removed panel); its content is irrelevant, only its presence matters.
	vec.seedStoredContent("ns", "test-model", "dashboards", "dash-a", "panel/2", "stale content", 1)

	text := &fakeText{dim: 4}
	emb := newFakeEmbedder(text)
	o, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
	})
	require.NoError(t, err)
	o.runBackfill(context.Background())

	require.Len(t, vec.replaceCalls, 1, "subresource-set drift must force the full re-embed path")
	assert.Equal(t, []string{items[0].Subresource}, vec.replaceCalls[0].Desired)
	assert.Equal(t, 1, text.calls)
	assert.Empty(t, vec.updateCalls)

	_, stillThere := vec.rows[rowsKey("ns", "test-model", "dashboards", "dash-a")]["panel/2"]
	assert.False(t, stillThere, "stale subresource must be dropped by the replace")
}

// TestRunBackfill_CompletedJobStaleVersion_ReopensAndProcesses covers job
// reopening: a job that finished under an older content_version is reopened
// (is_complete=false, cursor/error reset) and drained on the same tick.
// A zero reconciler checkpoint means nothing was ever embedded; reopening
// then would complete the job against an empty bound and strand it.
func TestReopenStaleJobs_ZeroCheckpoint_SkipsReopen(t *testing.T) {
	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100, IsComplete: true}}

	o := newBackfiller(t, newFakeStorage(), vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.reopenCalls)
}

// The reopened job's stopping RV is the reconciler checkpoint, not wall clock.
func TestReopenStaleJobs_UsesCheckpointAsStoppingRV(t *testing.T) {
	vec := newFakeVector()
	vec.latestRV = 424242
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100, IsComplete: true}}

	o := newBackfiller(t, newFakeStorage(), vec)
	o.runBackfill(context.Background())

	require.NotEmpty(t, vec.reopenCalls)
	assert.Equal(t, int64(424242), vec.reopenCalls[0].StoppingRV)
}

func TestRunBackfill_CompletedJobStaleVersion_ReopensAndProcesses(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.latestRV = 100 // reconciler checkpoint feeds the reopened job's stopping RV
	vec.jobs = []vector.BackfillJob{{
		ID:          1,
		Model:       "test-model",
		StoppingRV:  100,
		IsComplete:  true,
		LastSeenKey: encodeCursor("dashboards", "tok-stale"),
		LastError:   "old error",
	}}
	// Job's content_version defaults to 1 (the fake's DB-default stand-in);
	// the builder below has since bumped to 2.

	builder := versionedBuilder{dashboard.New(), 2}
	o := newBackfillerWithBuilders(t, storage, vec, builder)
	o.runBackfill(context.Background())

	require.Len(t, vec.reopenCalls, 1)
	assert.Equal(t, 2, vec.reopenCalls[0].Version)
	// Assert the reset directly: a dangling cursor happens to behave like a
	// cleared one against this fake's token parsing, so the upsert count
	// alone can't catch a missing reset.
	assert.Empty(t, vec.jobs[0].LastSeenKey, "reopen must clear the cursor")
	assert.Empty(t, vec.jobs[0].LastError, "reopen must clear the last error")
	require.Len(t, vec.upserts, 1, "reopened job must be processed on the same tick")
	require.Len(t, vec.completedJobIDs, 1, "job completes again after reprocessing")
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
	// dash-a already has an embedding at the builder's current version —
	// backfill should skip it. Version() must match dashboard.New(), or
	// ReopenStaleBackfillJobs treats the job itself as stale and resets its
	// cursor/stopping_rv, which is not what this test is about.
	vec.seedEmbeddedRows("ns-1", "test-model", "dashboards", "dash-a", dashboard.New().Version(), "panel/1")
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

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
	// Job already at the builder's current version, so ReopenStaleBackfillJobs
	// doesn't reset stopping_rv out from under this test's assertion.
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

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
	// Job already at the builder's current version, so ReopenStaleBackfillJobs
	// doesn't clear the checkpoint this test is resuming from.
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}

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

// newBackfillerWithStats mirrors newBackfiller but wires a stats provider.
func newBackfillerWithStats(t *testing.T, storage *fakeStorage, vec *fakeVector, stats builders.DashboardStats) *VectorBackfiller {
	t.Helper()
	emb := newFakeEmbedder(&fakeText{dim: 4})
	b, err := NewVectorBackfiller(Options{
		Storage:        storage,
		VectorBackend:  vec,
		BatchEmbedder:  embedder.NewBatchEmbedder(*emb),
		Builders:       []embed.Builder{dashboard.New()},
		DashboardStats: stats,
	})
	require.NoError(t, err)
	return b
}

// Integration: prove the views filter actually wires through the
// backfill pipeline. Asserts UID identity of what got embedded and that
// the job still completes when items are filtered.
func TestRunBackfillJob_ViewsFilter_SkipsZeroViewDashboards(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeListItem("ns", "cold", 50),
		makeListItem("ns", "hot", 60),
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	stats := newFakeDashboardStats()
	stats.set("ns", "cold", map[string]int64{"views_last_30_days": 0})
	stats.set("ns", "hot", map[string]int64{"views_last_30_days": 12})

	o := newBackfillerWithStats(t, storage, vec, stats)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "only the viewed dashboard should be embedded")
	assert.Equal(t, "hot", vec.upserts[0][0].UID)
	require.Len(t, vec.completedJobIDs, 1, "job still completes when items are filtered")
}

// Integration: the Exists short-circuit must run before the stats
// lookup so already-indexed dashboards don't burn a usageinsights call.
// This ordering isn't covered by the predicate-level tests below.
// Zero views only gates new embeds: version-stale rows re-embed regardless.
func TestRunBackfillJob_ViewsFilter_StaleZeroViewRows_ReembedsAnyway(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dusty", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	vec.jobContentVersion = map[int64]int{1: dashboard.New().Version()}
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "dusty", 1, "panel/1")

	stats := newFakeDashboardStats()
	stats.set("ns", "dusty", map[string]int64{"views_last_30_days": 0})

	o := newBackfillerWithStats(t, storage, vec, stats)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.deletes)
	require.Len(t, vec.replaceCalls, 1, "stale rows re-embed even with zero views")
	assert.Equal(t, 0, stats.calls, "stats lookup only runs for never-embedded uids")
}

func TestRunBackfillJob_ViewsFilter_ExistsShortCircuitSkipsStats(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "already-indexed", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	// Seed at the builder's current version so the ContentVersion
	// short-circuit actually fires; a stale version 1 would make this
	// dashboard eligible for re-embedding and reach the stats lookup below.
	vec.seedEmbeddedRows("ns", "test-model", "dashboards", "already-indexed", dashboard.New().Version(), "panel/1")

	stats := newFakeDashboardStats()
	stats.set("ns", "already-indexed", map[string]int64{"views_last_30_days": 0})

	o := newBackfillerWithStats(t, storage, vec, stats)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Equal(t, 0, stats.calls, "Exists short-circuit must come before stats lookup")
}

// shouldSkipForZeroViews branch coverage. Tests bypass the full backfill
// pipeline and call the predicate directly; the integration tests above
// cover wiring.

func TestShouldSkipForZeroViews_ZeroViews_Skips(t *testing.T) {
	stats := newFakeDashboardStats()
	stats.set("ns", "uid", map[string]int64{"views_last_30_days": 0})
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), stats)
	assert.True(t, b.shouldSkipForZeroViews(context.Background(), dashboard.New(), "ns", "uid"))
}

func TestShouldSkipForZeroViews_HasViews_DoesNotSkip(t *testing.T) {
	stats := newFakeDashboardStats()
	stats.set("ns", "uid", map[string]int64{"views_last_30_days": 1})
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), stats)
	assert.False(t, b.shouldSkipForZeroViews(context.Background(), dashboard.New(), "ns", "uid"))
}

func TestShouldSkipForZeroViews_MissingKey_DoesNotSkip(t *testing.T) {
	stats := newFakeDashboardStats()
	// Map present but views_last_30_days key absent.
	stats.set("ns", "uid", map[string]int64{"views_total": 9})
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), stats)
	assert.False(t, b.shouldSkipForZeroViews(context.Background(), dashboard.New(), "ns", "uid"))
}

func TestShouldSkipForZeroViews_ProviderError_DoesNotSkip(t *testing.T) {
	stats := newFakeDashboardStats()
	stats.err = fmt.Errorf("boom")
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), stats)
	assert.False(t, b.shouldSkipForZeroViews(context.Background(), dashboard.New(), "ns", "uid"))
}

func TestShouldSkipForZeroViews_NilProvider_DoesNotConsultAndDoesNotSkip(t *testing.T) {
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), nil)
	assert.False(t, b.shouldSkipForZeroViews(context.Background(), dashboard.New(), "ns", "uid"))
}

func TestShouldSkipForZeroViews_NonDashboardBuilder_DoesNotConsult(t *testing.T) {
	// Wiring only attaches the provider for dashboards today; the
	// builder-identity guard is defensive against future builders that
	// might travel with a non-nil DashboardStats. Asserts the provider
	// is never called.
	stats := newFakeDashboardStats()
	stats.set("ns", "uid", map[string]int64{"views_last_30_days": 0})
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), stats)
	skip := b.shouldSkipForZeroViews(context.Background(), fakeNonDashboardBuilder{}, "ns", "uid")
	assert.False(t, skip)
	assert.Equal(t, 0, stats.calls)
}

func TestShouldSkipForZeroViews_EmptyName_DoesNotConsult(t *testing.T) {
	stats := newFakeDashboardStats()
	b := newBackfillerWithStats(t, newFakeStorage(), newFakeVector(), stats)
	skip := b.shouldSkipForZeroViews(context.Background(), dashboard.New(), "ns", "")
	assert.False(t, skip)
	assert.Equal(t, 0, stats.calls)
}

type fakeNonDashboardBuilder struct{}

func (fakeNonDashboardBuilder) Group() string            { return "folder.grafana.app" }
func (fakeNonDashboardBuilder) Resource() string         { return "folders" }
func (fakeNonDashboardBuilder) MaxItemsPerResource() int { return 0 }
func (fakeNonDashboardBuilder) Version() int             { return 1 }
func (fakeNonDashboardBuilder) Extract(context.Context, *resourcepb.ResourceKey, []byte, string) ([]embed.Item, error) {
	return nil, nil
}

func labeledDashboardJSON(uid, title string) []byte {
	body, _ := json.Marshal(map[string]any{
		"metadata": map[string]any{
			"name":   uid,
			"labels": map[string]any{controller.LabelPendingDelete: "true"},
		},
		"spec": map[string]any{"uid": uid, "title": title},
	})
	return body
}

func makeLabeledListItem(ns, name string, rv int64) listItem {
	return listItem{Namespace: ns, Name: name, RV: rv, Value: labeledDashboardJSON(name, name+"-title")}
}

func TestRunBackfillJob_PendingDeleteLabel_SkipsLabeledResources(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		makeLabeledListItem("ns", "dash-a", 50),
		makeListItem("ns", "dash-b", 60),
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "only the unlabeled resource should be embedded")
	assert.Equal(t, "dash-b", vec.upserts[0][0].UID)
	require.Len(t, vec.completedJobIDs, 1, "job still completes when items are filtered")
}

func TestRunBackfillJob_PendingDeleteLabel_RunsBeforeStatsLookup(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeLabeledListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
	stats := newFakeDashboardStats()

	o := newBackfillerWithStats(t, storage, vec, stats)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Equal(t, 0, stats.calls, "pending-delete skip must come before stats lookup")
}

// azureAPIError populates Request/Response because Error() dereferences both.
func azureAPIError(status int) *openai.Error {
	req, _ := http.NewRequest(http.MethodPost, "https://example.test/embeddings", nil)
	return &openai.Error{
		StatusCode: status,
		Request:    req,
		Response:   &http.Response{StatusCode: status},
	}
}

func TestIsPermanentItemError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"pq data exception", &pq.Error{Code: "22021"}, true},
		{"wrapped pq data exception", fmt.Errorf("upsert: %w", &pq.Error{Code: "22021"}), true},
		{"pgx data exception", &pgconn.PgError{Code: "22021"}, true},
		{"pgx check violation", &pgconn.PgError{Code: "23514"}, false},
		// Class 23 stays retryable: a missing partition is 23514 check_violation.
		{"pq check violation", &pq.Error{Code: "23514"}, false},
		{"pq connection failure", &pq.Error{Code: "08006"}, false},
		{"pq insufficient resources", &pq.Error{Code: "53100"}, false},
		// Provider rejections stay retryable: misconfig produces the same codes.
		{"grpc invalid argument", grpcstatus.Error(grpccodes.InvalidArgument, "bad input"), false},
		{"bedrock validation", &smithy.GenericAPIError{Code: "ValidationException", Message: "bad input"}, false},
		{"azure bad request", azureAPIError(http.StatusBadRequest), false},
		{"grpc unavailable", grpcstatus.Error(grpccodes.Unavailable, "down"), false},
		{"plain error", errors.New("connection refused"), false},
		{"context canceled", context.Canceled, false},
		{"context deadline", context.DeadlineExceeded, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, isPermanentItemError(tc.err))
		})
	}
}

func TestRunBackfillJob_CorruptResource_SkippedNotFatal(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{
		// Truncated JSON: extract fails deterministically.
		{Namespace: "ns", Name: "poison", RV: 50, Value: []byte(`{"uid":"poison","panels":[`)},
		makeListItem("ns", "good", 60),
	}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.upserts, 1, "corrupt item skipped, good item embedded")
	assert.Equal(t, "good", vec.upserts[0][0].UID)
	assert.Empty(t, vec.errorMarks, "permanent errors must not fail the job")
	assert.Equal(t, []int64{1}, vec.completedJobIDs)
}

func TestRunBackfillJob_PermanentUpsertError_SkipsItem(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.upsertErr = &pq.Error{Code: "22021"}
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	assert.Empty(t, vec.errorMarks)
	assert.Equal(t, []int64{1}, vec.completedJobIDs)
}

func TestRunBackfillJob_RetryableUpsertError_FailsJob(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.upsertErr = errors.New("connection refused")
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	o := newBackfiller(t, storage, vec)
	o.runBackfill(context.Background())

	require.Len(t, vec.errorMarks, 1, "retryable errors keep failing the job for the next tick")
	assert.Empty(t, vec.completedJobIDs)
}

func TestRunBackfillJob_EmbedProviderError_FailsJob(t *testing.T) {
	storage := newFakeStorage()
	storage.listItems = []listItem{makeListItem("ns", "dash-a", 50)}

	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}

	emb := newFakeEmbedder(&fakeText{dim: 4, err: grpcstatus.Error(grpccodes.InvalidArgument, "input rejected")})
	b, err := NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
	})
	require.NoError(t, err)
	b.runBackfill(context.Background())

	assert.Empty(t, vec.upserts)
	require.Len(t, vec.errorMarks, 1)
	assert.Empty(t, vec.completedJobIDs)
}

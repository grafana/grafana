package reconciler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

const dashGroup = "dashboard.grafana.app"
const dashRes = "dashboards"
const testModel = "test-model"

// testRVBase anchors test RVs to a "now" snowflake RV
var testRVBase = resource.ToSnowflakeRV(time.Now().UnixMicro())

// snowflakeRV returns a snowflake-format RV offset from testRVBase
func snowflakeRV(offset int64) int64 { return testRVBase + offset }

// minimalDashboard returns a single-panel dashboard payload that the
// dashboard extractor will turn into one embed.Item.
func minimalDashboard(uid, title string) []byte {
	body, _ := json.Marshal(map[string]any{
		"uid":   uid,
		"title": title,
		"panels": []any{
			map[string]any{"id": 1, "title": "CPU", "description": "CPU usage"},
		},
	})
	return body
}

// multiPanelDashboard returns a dashboard with N panels — used to verify
// per-dashboard embedding does one EmbedText call regardless of panel count.
func multiPanelDashboard(uid, title string, n int) []byte {
	panels := make([]any, n)
	for i := range n {
		panels[i] = map[string]any{"id": i + 1, "title": uid, "description": "panel"}
	}
	body, _ := json.Marshal(map[string]any{"uid": uid, "title": title, "panels": panels})
	return body
}

// newReconciler builds a Reconciler without running a cycle. Tests that
// want the sweep should set vec.latestRV first (so the sweep doesn't
// short-circuit on RV=0) and call s.sweep(ctx) explicitly.
func newReconciler(t *testing.T, st *fakeStorage, vec *fakeVector) (*Reconciler, *fakeText) {
	t.Helper()
	text := &fakeText{dim: 4}
	s, err := New(Options{
		Storage:       st,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(text)),
		Builders:      []embed.Builder{dashboard.New()},
		Interval:      time.Hour,
	})
	require.NoError(t, err)
	return s, text
}

// newReconcilerWithBuilders is newReconciler with an explicit builder set.
func newReconcilerWithBuilders(t *testing.T, st *fakeStorage, vec *fakeVector, builders ...embed.Builder) *Reconciler {
	t.Helper()
	s, err := New(Options{
		Storage:       st,
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})),
		Builders:      builders,
		Interval:      time.Hour,
	})
	require.NoError(t, err)
	return s
}

// dashEvent builds a pendingEvent with the dashboard group/resource pre-filled.
func dashEvent(action resourcepb.WatchEvent_Type, ns, name string, rv int64, value []byte) *pendingEvent {
	return &pendingEvent{
		action:    action,
		group:     dashGroup,
		resource:  dashRes,
		namespace: ns,
		name:      name,
		value:     value,
		rv:        rv,
	}
}

func dashChange(action resourcepb.WatchEvent_Type, ns, name string, rv int64, value []byte) *resource.ModifiedResource {
	return &resource.ModifiedResource{
		Action: action,
		Key: resourcepb.ResourceKey{
			Group: dashGroup, Resource: dashRes, Namespace: ns, Name: name,
		},
		ResourceVersion: rv,
		Value:           value,
	}
}

// change builds a ModifiedResource for a group/resource without a
// dedicated helper.
func change(group, res, ns, name string, rv int64, value []byte) *resource.ModifiedResource {
	return &resource.ModifiedResource{
		Action:          resourcepb.WatchEvent_ADDED,
		Key:             resourcepb.ResourceKey{Group: group, Resource: res, Namespace: ns, Name: name},
		ResourceVersion: rv,
		Value:           value,
	}
}

func TestReconciler_NewValidatesInputs(t *testing.T) {
	cases := []struct {
		name string
		mod  func(*Options)
	}{
		{"missing builders", func(o *Options) { o.Builders = nil }},
		{"duplicated builders", func(o *Options) { o.Builders = []embed.Builder{dashboard.New(), dashboard.New()} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opts := Options{
				Storage:       &fakeStorage{},
				VectorBackend: newFakeVector(),
				Builders:      []embed.Builder{dashboard.New()},
			}
			tc.mod(&opts)
			_, err := New(opts)
			require.Error(t, err)
		})
	}
}

func TestReconciler_EmptyQueue_NoOp(t *testing.T) {
	st := &fakeStorage{}
	vec := newFakeVector()
	s, text := newReconciler(t, st, vec)

	s.processPending(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.deletes)
	assert.Equal(t, 0, text.calls)
	assert.Equal(t, int64(0), vec.latestRV)
}

// TestReconciler_ObservesProcessDuration verifies the per-event histogram
// fires when an event is processed. A regression here would mean the wiring
// between processEvent and VectorMetrics is broken.
func TestReconciler_ObservesProcessDuration(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := resource.ProvideVectorMetrics(reg)

	text := &fakeText{dim: 4}
	s, err := New(Options{
		Storage:       &fakeStorage{},
		VectorBackend: newFakeVector(),
		BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(text)),
		Builders:      []embed.Builder{dashboard.New()},
		Interval:      time.Hour,
		Metrics:       m,
	})
	require.NoError(t, err)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())

	// One successful observation under the (group, resource, status) labels
	// the production code uses.
	require.Equal(t, 1, testutil.CollectAndCount(m.ReconcilerProcessDuration, "vector_storage_reconciler_process_duration_seconds"))
}

func TestReconciler_RecordEmbeddingCounts(t *testing.T) {
	m := resource.ProvideVectorMetrics(prometheus.NewPedanticRegistry())
	vec := newFakeVector()
	vec.counts = []vector.EmbeddingCount{
		{Resource: "dashboards", Model: testModel, Count: 7},
		{Resource: "folders", Model: testModel, Count: 3},
	}
	s, err := New(Options{
		Storage:       &fakeStorage{},
		VectorBackend: vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})),
		Builders:      []embed.Builder{dashboard.New()},
		Interval:      time.Hour,
		Metrics:       m,
	})
	require.NoError(t, err)

	s.recordEmbeddingCounts(context.Background())
	assert.Equal(t, 7.0, testutil.ToFloat64(m.EmbeddingsStored.WithLabelValues("dashboards", testModel)))
	assert.Equal(t, 3.0, testutil.ToFloat64(m.EmbeddingsStored.WithLabelValues("folders", testModel)))

	// A label pair that disappears must stop being exported, not linger at
	// its last value.
	vec.counts = []vector.EmbeddingCount{{Resource: "dashboards", Model: testModel, Count: 9}}
	s.recordEmbeddingCounts(context.Background())
	assert.Equal(t, 1, testutil.CollectAndCount(m.EmbeddingsStored, "vector_storage_embeddings_stored"))
	assert.Equal(t, 9.0, testutil.ToFloat64(m.EmbeddingsStored.WithLabelValues("dashboards", testModel)))

	// A backend error leaves the last good sample in place.
	vec.counts, vec.countsErr = nil, errors.New("boom")
	s.recordEmbeddingCounts(context.Background())
	assert.Equal(t, 9.0, testutil.ToFloat64(m.EmbeddingsStored.WithLabelValues("dashboards", testModel)))
}

func TestReconciler_HappyPath_PerDashboardEmbed(t *testing.T) {
	// Two dashboards from different namespaces should produce two
	// EmbedText calls (one per dashboard) and two Upsert calls.
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns-a", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns-b", "dash-2", 200, minimalDashboard("dash-2", "Dash 2")))

	s.processPending(context.Background())

	assert.Equal(t, 2, text.calls, "one EmbedText call per dashboard")
	require.Len(t, vec.upserts, 2, "one Upsert per dashboard")
}

func TestReconciler_HappyPath_StampsBuilderVersion(t *testing.T) {
	// Upserted vectors carry the builder's content-format version, not
	// whatever the RV or an arbitrary literal happens to be.
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))

	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1)
	require.NotEmpty(t, vec.upserts[0])
	for _, v := range vec.upserts[0] {
		assert.Equal(t, dashboard.New().Version(), v.ContentVersion)
	}
}

func TestReconciler_MultiPanelDashboard_SingleEmbedCall(t *testing.T) {
	// All panels of one dashboard go through BatchEmbedder.Embed in
	// a single call (provider-side chunking handles panel count).
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "big", 100, multiPanelDashboard("big", "Big Dash", 12)))

	s.processPending(context.Background())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	assert.Len(t, vec.upserts[0], 12, "12 panels = 12 vectors in the upsert")
}

func TestReconciler_DeleteEvent_CallsVectorDelete(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash-x", 50, nil))

	s.processPending(context.Background())

	require.Len(t, vec.deletes, 1)
	assert.Equal(t, deleteCall{Namespace: "ns", Model: testModel, Resource: dashRes, UID: "dash-x"}, vec.deletes[0])
	assert.Equal(t, 0, text.calls, "delete does not call the embedder")
}

func TestReconciler_StaleSubresources_AreDeletedBeforeUpsert(t *testing.T) {
	// Pre-seed two stored panels under one dashboard, then drive an
	// update whose extract only contains panel/1.
	vec := newFakeVector()
	k := subsKey("ns", testModel, dashRes, "dash-1")
	vec.storedSubs[k] = map[string]string{
		"panel/1": "old content",
		"panel/2": "stale panel that should be deleted",
	}

	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())

	require.Len(t, vec.delsubs, 1)
	assert.ElementsMatch(t, []string{"panel/2"}, vec.delsubs[0].Subresources)
	require.Len(t, vec.upserts, 1)
}

// threePanelDashboard builds a 3-panel dashboard with distinct per-panel content.
func threePanelDashboard(panel2Title string) []byte {
	body, _ := json.Marshal(map[string]any{
		"uid": "dash-1", "title": "Dash",
		"panels": []any{
			map[string]any{"id": 1, "title": "CPU", "description": "cpu"},
			map[string]any{"id": 2, "title": panel2Title, "description": "mem"},
			map[string]any{"id": 3, "title": "Disk", "description": "disk"},
		},
	})
	return body
}

// Re-processing with one panel changed re-embeds only that panel.
func TestReconciler_PartialReembed_OnlyChangedPanel(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, threePanelDashboard("Mem")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Len(t, vec.upserts[0], 3, "first write embeds all three panels")
	require.Equal(t, 1, text.calls)

	// Only panel/2's title changes.
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, threePanelDashboard("Memory")))
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 2, "second write happened")
	require.Len(t, vec.upserts[1], 1, "only the changed panel is re-embedded")
	assert.Equal(t, "panel/2", vec.upserts[1][0].Subresource)
	assert.Equal(t, 2, text.calls)
	assert.Equal(t, []int{1}, text.textSets[1], "embedder called with exactly one text")
	assert.Empty(t, vec.delsubs, "nothing deleted; every panel is still desired")
}

// Re-processing identical content writes nothing but still advances the checkpoint.
func TestReconciler_PartialReembed_NoChangeSkipsWrite(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, 1, text.calls)

	// Re-process byte-identical content at a higher RV.
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1, "no re-embed when content is unchanged")
	assert.Equal(t, 1, text.calls, "embedder not called again")
	assert.Empty(t, vec.delsubs, "nothing deleted")
}

// dashboardInFolder sets the folder UID via the grafana.app/folder annotation.
func dashboardInFolder(uid, title, folderUID string) []byte {
	body, _ := json.Marshal(map[string]any{
		"uid": uid, "title": title,
		"metadata": map[string]any{
			"annotations": map[string]any{"grafana.app/folder": folderUID},
		},
		"panels": []any{
			map[string]any{"id": 1, "title": "CPU", "description": "CPU usage"},
		},
	})
	return body
}

// A folder move doesn't change content but must refresh the authz
// folder, so it forces a re-embed.
func TestReconciler_PartialReembed_FolderMoveReembeds(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, dashboardInFolder("dash-1", "Dash", "folder-a")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, "folder-a", vec.upserts[0][0].Folder)
	require.Equal(t, 1, text.calls)

	// Move to folder-b; panel content is identical.
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, dashboardInFolder("dash-1", "Dash", "folder-b")))
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 2, "folder move re-embeds despite unchanged content")
	assert.Equal(t, "folder-b", vec.upserts[1][0].Folder, "stored folder refreshed to the new folder")
	assert.Equal(t, 2, text.calls)
}

// TestReconciler_FolderTitle_PrefixesBreadcrumb covers the wiring: the
// reconciler resolves the folder title via storage and passes it to Extract,
// which prefixes the breadcrumb.
func TestReconciler_FolderTitle_PrefixesBreadcrumb(t *testing.T) {
	vec := newFakeVector()
	storage := &fakeStorage{}
	storage.setFolderTitle("ns", "folder-a", "Production")
	s, _ := newReconciler(t, storage, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, dashboardInFolder("dash-1", "Dash", "folder-a")))
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1)
	require.NotEmpty(t, vec.upserts[0])
	assert.Contains(t, vec.upserts[0][0].Content, "Production → Dash")
}

// TestReconciler_FolderTitleResolveError_BlocksAdvance covers the retry
// contract: a folder-title storage error is treated like any other
// per-event failure — it blocks the cursor and re-queues the event, rather
// than being swallowed.
func TestReconciler_FolderTitleResolveError_BlocksAdvance(t *testing.T) {
	vec := newFakeVector()
	storage := &fakeStorage{readErr: errBoom}
	s, text := newReconciler(t, storage, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, dashboardInFolder("dash-1", "Dash", "folder-a")))
	s.processPending(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Equal(t, 0, text.calls, "resolver error must short-circuit before embedding")

	s.pendingMu.Lock()
	_, hasPending := s.pending[pendingKey(dashGroup, dashRes, "ns", "dash-1")]
	s.pendingMu.Unlock()
	assert.True(t, hasPending, "resolver error re-queues the event for retry")
}

// A panel removed with no other change must delete the stale row without
// embedding anything (empty changed, non-empty desired).
func TestReconciler_PartialReembed_DeleteOnly(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, threePanelDashboard("Mem")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts[0], 3)
	require.Equal(t, 1, text.calls)

	// Drop panel/3 (Disk); panels 1 and 2 are byte-identical.
	twoPanel, _ := json.Marshal(map[string]any{
		"uid": "dash-1", "title": "Dash",
		"panels": []any{
			map[string]any{"id": 1, "title": "CPU", "description": "cpu"},
			map[string]any{"id": 2, "title": "Mem", "description": "mem"},
		},
	})
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, twoPanel))
	s.processPending(context.Background())

	assert.Equal(t, 1, text.calls, "no embed; surviving panels unchanged")
	require.Len(t, vec.delsubs, 1, "the removed panel is deleted")
	assert.ElementsMatch(t, []string{"panel/3"}, vec.delsubs[0].Subresources)
}

// Two panels can map to the same subresource (explicit id N and an
// id-less panel at positional index N both yield panel/N). A stale row
// must still be detected and deleted — a per-item match count would
// double-count the collision and wrongly skip the cleanup.
func TestReconciler_PartialReembed_SubresourceCollision_DeletesStale(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	collide, _ := json.Marshal(map[string]any{
		"uid": "dash-1", "title": "Dash",
		"panels": []any{
			map[string]any{"id": 1, "title": "X", "description": "d"}, // panel/1
			map[string]any{"title": "X", "description": "d"},          // no id, idx 1 → panel/1
		},
	})

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, collide))
	s.processPending(context.Background())
	require.Equal(t, 1, text.calls)

	// A stale subresource that no longer exists in the dashboard.
	vec.storedSubs[subsKey("ns", testModel, dashRes, "dash-1")]["panel/9"] = "stale"

	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, collide))
	s.processPending(context.Background())

	require.Len(t, vec.delsubs, 1, "stale row deleted despite the subresource collision")
	assert.ElementsMatch(t, []string{"panel/9"}, vec.delsubs[0].Subresources)
}

// The same resource written again at a higher RV re-embeds on the next
// cycle; dedup keeps the newer copy rather than the one already queued.
func TestReconciler_SameResourceHigherRV_ReembedsNextCycle(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, 1, text.calls)

	// Same dashboard at a higher RV: dedup keeps the new one.
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1 v2")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 2)
	require.Equal(t, 2, text.calls)
}

func TestReconciler_UnknownAction_BlocksAdvance(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(&pendingEvent{
		action:    resourcepb.WatchEvent_BOOKMARK,
		group:     dashGroup,
		resource:  dashRes,
		namespace: "ns",
		name:      "weird",
		rv:        50,
	})
	s.processPending(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.deletes)
	assert.Equal(t, 0, text.calls)
	assert.Equal(t, int64(49), vec.latestRV, "checkpoint stops at (failed - 1)")
}

// ---------- Sweep ----------

func TestReconciler_Sweep_SkipsWhenCursorIsZero(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")),
	}
	vec := newFakeVector() // latestRV stays 0
	s, text := newReconciler(t, st, vec)

	s.sweep(context.Background())
	s.processPending(context.Background())

	assert.Empty(t, vec.upserts, "the sweep is a no-op when cursor is 0")
	assert.Equal(t, 0, text.calls)
}

func TestReconciler_Sweep_PullsCrossNamespaceEvents(t *testing.T) {
	// Cursor non-zero → the sweep walks every namespace in one pass via
	// cross-namespace ListModifiedSince, enqueues each event, processes
	// them per-dashboard.
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns-a", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns-b", "dash-2", snowflakeRV(200), minimalDashboard("dash-2", "Dash 2")),
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50) // anything below the change RVs
	s, text := newReconciler(t, st, vec)

	s.sweep(context.Background())
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 2)
	assert.Equal(t, 2, text.calls)
	assert.Equal(t, snowflakeRV(200), vec.latestRV)
}

func TestReconciler_Sweep_FiltersBelowCursor(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "old", snowflakeRV(100), minimalDashboard("old", "Old")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "new", snowflakeRV(200), minimalDashboard("new", "New")),
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(150)
	s, _ := newReconciler(t, st, vec)

	s.sweep(context.Background())
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new", vec.upserts[0][0].UID)
}

// ---------- Watch path ----------

func TestReconciler_WatchEvent_DrivesNextCycle(t *testing.T) {
	st := &fakeStorage{}
	vec := newFakeVector()
	s, text := newReconciler(t, st, vec)

	s.processPending(context.Background())
	require.Empty(t, vec.upserts)
	require.Equal(t, 0, text.calls)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns-x", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, 1, text.calls)
}

func TestReconciler_WatchConsumer_IgnoresUnrelatedResources(t *testing.T) {
	st := &fakeStorage{}
	vec := newFakeVector()
	s, _ := newReconciler(t, st, vec)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ch, err := st.WatchWriteEvents(ctx)
	require.NoError(t, err)
	go s.consumeWatchEvents(ctx, ch)

	st.emit(&resource.WrittenEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Group: "folder.grafana.app", Resource: "folders", Namespace: "ns-x", Name: "f1",
		},
		ResourceVersion: 50,
	})
	st.emit(&resource.WrittenEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Group: dashGroup, Resource: dashRes, Namespace: "ns-y", Name: "d1",
		},
		Value:           minimalDashboard("d1", "Dash 1"),
		ResourceVersion: 60,
	})

	dashKey := pendingKey(dashGroup, dashRes, "ns-y", "d1")
	folderKey := pendingKey("folder.grafana.app", "folders", "ns-x", "f1")
	require.Eventually(t, func() bool {
		s.pendingMu.Lock()
		defer s.pendingMu.Unlock()
		_, dashboardQueued := s.pending[dashKey]
		_, folderQueued := s.pending[folderKey]
		return dashboardQueued && !folderQueued
	}, time.Second, 10*time.Millisecond)
}

// ---------- Dedup ----------

func TestReconciler_EnqueueDedup_KeepsHighestRV(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "Old Title")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash", 200, minimalDashboard("dash", "New Title")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "Old Again")))

	s.processPending(context.Background())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	require.Len(t, vec.upserts[0], 1)
	assert.Equal(t, int64(200), vec.upserts[0][0].ResourceVersion)
}

func TestReconciler_EnqueueDedup_DeleteOverridesOlderUpsert(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "Title")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash", 200, nil))

	s.processPending(context.Background())

	assert.Empty(t, vec.upserts, "older upsert overridden by newer delete")
	require.Len(t, vec.deletes, 1)
	assert.Equal(t, "dash", vec.deletes[0].UID)
}

// Events at or below the cursor were covered by the walk that moved the
// cursor there, so the live path filters them out: they cost an embed
// call, and a late copy would overwrite the newer content that walk
// already indexed.
func TestReconciler_FiltersEventsAtOrBelowCursor(t *testing.T) {
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(150)
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "old", snowflakeRV(100), minimalDashboard("old", "Old")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "new", snowflakeRV(200), minimalDashboard("new", "New")))

	s.processPending(t.Context())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new", vec.upserts[0][0].UID)

	// A late copy of "new" from below the cursor must not replace what is
	// already indexed for it.
	indexed := vec.storedContentFor("ns", dashRes, "new")
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "new", snowflakeRV(140), minimalDashboard("new", "Stale")))
	s.processPending(t.Context())

	assert.Len(t, vec.upserts, 1, "the stale copy is not embedded")
	assert.Equal(t, indexed, vec.storedContentFor("ns", dashRes, "new"), "indexed content untouched")
}

// ---------- Retry cap ----------

func TestReconciler_RetryCap_DropsEventAfterMaxAttempts(t *testing.T) {
	vec := newFakeVector()
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "boom", 100, minimalDashboard("boom", "Boom")))

	for range maxEventAttempts {
		s.processPending(context.Background())
	}

	require.Equal(t, 0, s.pendingLen(), "event dropped after max attempts")
	assert.Empty(t, vec.upserts)

	// A subsequent healthy event proves the reconciler is unblocked.
	vec.upsertErr = nil
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns-other", "ok", 200, minimalDashboard("ok", "OK")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 1)
}

func TestReconciler_RetryCap_FreshHigherRVResetsBudget(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	failingEv := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "v1"))
	failingEv.attempts = maxEventAttempts - 1
	s.enqueue(failingEv)

	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash", 200, minimalDashboard("dash", "v2")))

	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, int64(200), vec.upserts[0][0].ResourceVersion)
}

func TestReconciler_RetryCap_ReEnqueuePreservesAttempts(t *testing.T) {
	vec := newFakeVector()
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "v1")))

	s.processPending(context.Background())
	require.Equal(t, 1, s.pendingLen())

	s.pendingMu.Lock()
	queued := s.pending[pendingKey(dashGroup, dashRes, "ns", "dash")]
	s.pendingMu.Unlock()
	require.NotNil(t, queued)
	assert.Equal(t, 1, queued.attempts)
}

// ---------- pickLatestRV unit ----------

// ---------- Pod-lifetime lock ----------

func TestReconciler_AcquireLockBlocking_BlocksUntilAvailable(t *testing.T) {
	vec := newFakeVector()
	vec.lockUnavailable = true
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.lockRetryInterval = 10 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	type result struct {
		release func()
		err     error
	}
	done := make(chan result, 1)
	go func() {
		r, err := s.acquireLockBlocking(ctx)
		done <- result{r, err}
	}()

	select {
	case <-done:
		t.Fatal("acquireLockBlocking returned despite lock being held")
	case <-time.After(50 * time.Millisecond):
	}

	vec.mu.Lock()
	vec.lockUnavailable = false
	vec.mu.Unlock()

	select {
	case r := <-done:
		require.NoError(t, r.err)
		require.NotNil(t, r.release)
		r.release()
	case <-time.After(time.Second):
		t.Fatal("acquireLockBlocking didn't return after lock became available")
	}
}

func TestReconciler_AcquireLockBlocking_RespectsContextCancel(t *testing.T) {
	vec := newFakeVector()
	vec.lockUnavailable = true
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.lockRetryInterval = 100 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	_, err := s.acquireLockBlocking(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

// ---------- Startup pagination ----------

// TestReconciler_Sweep_FlushesAtBatchSize verifies that
// the sweep drains the listing iterator in startupBatchSize-sized
// chunks (so memory stays bounded) but advances the cursor exactly once
// at the end. Advancing per batch would lose events: the event store
// yields RV-descending, so the first (highest-RV) batch would bump the
// cursor past every later, lower-RV batch.
func TestReconciler_Sweep_FlushesAtBatchSize(t *testing.T) {
	prev := startupBatchSize
	startupBatchSize = 3
	t.Cleanup(func() { startupBatchSize = prev })

	st := &fakeStorage{}
	// Emit in DESC order, as the event store does.
	for i := 6; i >= 0; i-- {
		rv := snowflakeRV(int64(100 + i*10))
		name := fmt.Sprintf("dash-%d", i)
		st.changes = append(st.changes,
			dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	s, _ := newReconciler(t, st, vec)

	s.sweep(context.Background())

	require.Len(t, vec.upserts, 7, "every event must be processed across batched flushes")
	assert.Equal(t, snowflakeRV(160), vec.latestRV, "cursor advances to highest RV")
	assert.Equal(t, 0, s.pendingLen(), "queue is empty after startup")
	assert.Equal(t, 1, vec.setLatestRVCalls, "cursor advances exactly once at end of startup")
}

// TestReconciler_Sweep_DescOrderDoesNotDropEvents is the regression
// test for the bug where the sweep flushed each
// batch via processBatch (which advances the cursor) while the event
// store yields RV-descending. The first batch held the highest RVs, the
// cursor jumped past every subsequent (lower-RV) batch's events, and
// they were silently filtered out by the "ev.rv <= sinceRv" guard.
func TestReconciler_Sweep_DescOrderDoesNotDropEvents(t *testing.T) {
	prev := startupBatchSize
	startupBatchSize = 2
	t.Cleanup(func() { startupBatchSize = prev })

	st := &fakeStorage{}
	// Strictly descending RV order, as the event store yields.
	for i := 5; i >= 0; i-- {
		rv := snowflakeRV(int64(100 + i*10))
		name := fmt.Sprintf("dash-%d", i)
		st.changes = append(st.changes,
			dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	s, _ := newReconciler(t, st, vec)

	s.sweep(context.Background())

	assert.Len(t, vec.upserts, 6, "every event embedded even though batches arrive in DESC order")
	assert.Equal(t, snowflakeRV(150), vec.latestRV)
}

// Asserts the batch flushes on the byte cap. No flush count is exposed, so
// observe it via the lazily-pulled iterator: yields-at-each-upsert is
// [1,2,..] when flushing per event, [N,N,..] for one terminal flush. The
// end-state invariants alone can't see the byte branch.
func TestReconciler_Sweep_FlushesAtByteBudget(t *testing.T) {
	// run returns the iterator-yield count observed at each upsert.
	run := func(t *testing.T, capBytes int) []int {
		prevCount, prevBytes := startupBatchSize, maxStartupBatchBytes
		startupBatchSize = 1000 // high enough that only the byte cap can fire
		maxStartupBatchBytes = capBytes
		t.Cleanup(func() {
			startupBatchSize, maxStartupBatchBytes = prevCount, prevBytes
		})

		st := &fakeStorage{}
		for i := range 6 {
			rv := snowflakeRV(int64(100 + i*10))
			name := fmt.Sprintf("dash-%d", i)
			st.changes = append(st.changes,
				dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
		}

		vec := newFakeVector()
		vec.latestRV = snowflakeRV(50)

		var yielded int
		var atUpsert []int
		st.onYield = func() { yielded++ }
		vec.onUpsert = func() { atUpsert = append(atUpsert, yielded) }

		s, _ := newReconciler(t, st, vec)
		s.sweep(context.Background())

		require.Len(t, vec.upserts, 6, "every event embedded")
		assert.Equal(t, snowflakeRV(150), vec.latestRV, "cursor advances to highest RV")
		assert.Equal(t, 0, s.pendingLen(), "queue empty after startup")
		return atUpsert
	}

	t.Run("byte cap flushes per event", func(t *testing.T) {
		// cap=1: every non-empty value trips the byte cap → flush per event.
		assert.Equal(t, []int{1, 2, 3, 4, 5, 6}, run(t, 1))
	})

	t.Run("cap off defers to one terminal flush", func(t *testing.T) {
		// 1<<40: neither cap fires for 6 events → one terminal flush.
		assert.Equal(t, []int{6, 6, 6, 6, 6, 6}, run(t, 1<<40))
	})
}

// When SetLatestRV fails after the embeds succeeded, the cursor stays
// put and the next sweep re-lists from it. Nothing is re-enqueued: only
// a re-walk can prove the RV again.
func TestReconciler_Sweep_CheckpointWriteFailure_RetriesNextRun(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")),
	}}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	vec.setLatestRVErr = errBoom
	s, _ := newReconciler(t, st, vec)

	s.sweep(t.Context())

	require.Len(t, vec.upserts, 1, "embeds succeeded even though the cursor write failed")
	assert.Equal(t, snowflakeRV(50), vec.latestRV, "cursor stays at old value when SetLatestRV errors")
	assert.Zero(t, s.pendingLen(), "nothing queued; the next walk re-proves the RV")

	vec.setLatestRVErr = nil
	s.sweep(t.Context())

	assert.Equal(t, snowflakeRV(100), vec.latestRV, "the next sweep advances the cursor")
}

// A successful embed releases the event's value, so a caller
// accumulating successes over a long backlog doesn't retain every
// dashboard body. Replaying a released event must then be a no-op, and
// above all must not delete the vectors it already wrote.
func TestReconciler_EmbeddedValueReleasedAndReplaysAsNoOp(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	ev := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-0", snowflakeRV(100), minimalDashboard("dash-0", "Dash 0"))

	_, failed, successes, abort := s.processEvents(t.Context(), []*pendingEvent{ev})
	require.False(t, abort)
	require.Empty(t, failed)
	require.Len(t, successes, 1)
	require.Nil(t, ev.value, "value released after a successful embed")

	ev.rv = snowflakeRV(110)
	s.enqueue(ev)
	s.processPending(t.Context())

	assert.Equal(t, 1, text.calls, "replay does not re-embed")
	assert.Len(t, vec.upserts, 1, "replay does not upsert")
	assert.Empty(t, vec.deletes, "replay does not delete")
}

// TestReconciler_Sweep_DoesNotProcessWatchEvents verifies
// that a watch event queued while the sweep is iterating is left in the
// global queue and is NOT processed mid-batch. If it were, its higher
// RV would advance the cursor past iter events not yet yielded, which
// would then be filtered out and never embedded.
func TestReconciler_Sweep_DoesNotProcessWatchEvents(t *testing.T) {
	prev := startupBatchSize
	startupBatchSize = 2
	t.Cleanup(func() { startupBatchSize = prev })

	st := &fakeStorage{}
	for i := range 4 {
		rv := snowflakeRV(int64(100 + i*10))
		name := fmt.Sprintf("iter-%d", i)
		st.changes = append(st.changes,
			dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	s, _ := newReconciler(t, st, vec)

	// Pre-seed the global queue with a watch event at a much higher RV
	// for an unrelated dashboard. If the sweep incorrectly drained the
	// global queue, this RV (9999) would become the new cursor and the
	// remaining iter events would be filtered out.
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "watch-only", snowflakeRV(9999),
		minimalDashboard("watch-only", "Watch Only")))

	s.sweep(context.Background())

	// All 4 iter events embedded, watch event still queued.
	require.Len(t, vec.upserts, 4, "all iter events processed by the sweep")
	for _, batch := range vec.upserts {
		require.NotEmpty(t, batch)
		assert.NotEqual(t, "watch-only", batch[0].UID, "watch event must not be processed by the sweep")
	}
	assert.Equal(t, snowflakeRV(130), vec.latestRV, "cursor stays within the swept range")
	assert.Equal(t, 1, s.pendingLen(), "watch event remains in global queue for the next cycle")

	// A subsequent processPending drains the watch event.
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 5)
	assert.Equal(t, "watch-only", vec.upserts[4][0].UID)
	assert.Equal(t, snowflakeRV(130), vec.latestRV,
		"draining live events does not move the cursor past the swept window")
}

// TestReconciler_Sweep_SkipsIterEventsSupersededByWatch
// verifies the iter-side dedup: when watch has already queued a newer
// event for a dashboard, the iter's older copy is dropped before
// processing rather than wasting an embed call.
func TestReconciler_Sweep_SkipsIterEventsSupersededByWatch(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "shared", snowflakeRV(100), minimalDashboard("shared", "v1")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "other", snowflakeRV(110), minimalDashboard("other", "Other")),
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	s, _ := newReconciler(t, st, vec)

	// Watch already saw a newer write for "shared".
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "shared", snowflakeRV(500),
		minimalDashboard("shared", "v2")))

	s.sweep(context.Background())

	// "other" is processed by the sweep; "shared" is skipped because
	// watch's @500 supersedes iter's @100.
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "other", vec.upserts[0][0].UID)
	assert.Equal(t, 1, s.pendingLen(), "watch's shared@500 stays queued")
}

func TestChooseTarget(t *testing.T) {
	const noFail = int64(1<<63 - 1)
	cases := []struct {
		name                                    string
		sinceRv, latestRv, lowestFailedRv, want int64
	}{
		{"no failures advances to latest", 50, 200, noFail, 200},
		{"failure advances to fail-1", 50, 200, 120, 119},
		{"failure at sinceRv+1 stays put", 50, 200, 51, 50},
		{"failure at sinceRv stays put", 50, 200, 50, 50},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := pickLatestRV(tc.sinceRv, tc.latestRv, tc.lowestFailedRv)
			require.Equal(t, tc.want, got)
		})
	}
}

// newRunnable builds a Reconciler with sub-millisecond tickers so the
// Run tests don't sit waiting on real intervals. Caller is expected to
// cancel the returned context to make Run exit.
func newRunnable(t *testing.T, st *fakeStorage, vec *fakeVector) (*Reconciler, *fakeText) {
	t.Helper()
	text := &fakeText{dim: 4}
	s, err := New(Options{
		Storage:           st,
		VectorBackend:     vec,
		BatchEmbedder:     embedder.NewBatchEmbedder(*newFakeEmbedder(text)),
		Builders:          []embed.Builder{dashboard.New()},
		Interval:          5 * time.Millisecond,
		LockRetryInterval: 1 * time.Millisecond,
	})
	require.NoError(t, err)
	return s, text
}

// TestReconciler_Run_ExitsOnContextCancel covers the happy-path
// shutdown: Run holds the lock for the pod's lifetime and only
// returns when ctx is cancelled, propagating ctx.Err().
func TestReconciler_Run_ExitsOnContextCancel(t *testing.T) {
	vec := newFakeVector()
	s, _ := newRunnable(t, &fakeStorage{}, vec)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	// Let Run get past acquireLockBlocking and into the active state.
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return vec.lockAttempts >= 1
	}, time.Second, time.Millisecond, "lock should be acquired")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}

	vec.mu.Lock()
	defer vec.mu.Unlock()
	assert.Equal(t, 1, vec.lockReleases, "lock released exactly once on shutdown")
}

// TestReconciler_Run_BlocksUntilLockAvailable pins the
// one-replica-active invariant: Run retries the advisory lock at
// lockRetryInterval and only proceeds once it succeeds. Flipping
// lockUnavailable to false mid-flight unblocks it.
func TestReconciler_Run_BlocksUntilLockAvailable(t *testing.T) {
	vec := newFakeVector()
	vec.lockUnavailable = true
	s, _ := newRunnable(t, &fakeStorage{}, vec)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	// Wait for at least a couple of failed acquires before releasing.
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return vec.lockAttempts >= 2
	}, time.Second, time.Millisecond, "Run should retry the lock")

	vec.mu.Lock()
	attemptsBefore := vec.lockAttempts
	vec.lockUnavailable = false
	vec.mu.Unlock()

	// Once the lock becomes available Run acquires it and enters
	// active state. Cancel and assert clean shutdown.
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return vec.lockAttempts > attemptsBefore
	}, time.Second, time.Millisecond, "Run should re-attempt after we flip the lock")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}

	vec.mu.Lock()
	defer vec.mu.Unlock()
	assert.Equal(t, 1, vec.lockReleases, "lock released after a successful acquire")
}

// TestReconciler_Run_ContextCancelDuringLockWait exits cleanly even
// when the lock is never available — ctx cancellation must unstick
// acquireLockBlocking and Run must NOT call the release function
// (it never acquired).
func TestReconciler_Run_ContextCancelDuringLockWait(t *testing.T) {
	vec := newFakeVector()
	vec.lockUnavailable = true
	s, _ := newRunnable(t, &fakeStorage{}, vec)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return vec.lockAttempts >= 1
	}, time.Second, time.Millisecond)

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}

	vec.mu.Lock()
	defer vec.mu.Unlock()
	assert.Equal(t, 0, vec.lockReleases, "no lock to release when ctx is cancelled mid-wait")
}

// TestReconciler_Run_RunsStartupAndCycles asserts the end-to-end
// behavior: Run sweeps immediately (embedding the pre-existing
// changes) and then ticks the queue (embedding watch-style events
// pushed onto the queue). Both must land in vec.upserts before ctx
// is cancelled.
func TestReconciler_Run_RunsStartupAndCycles(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "startup-1", snowflakeRV(100), minimalDashboard("startup-1", "Startup 1")),
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50) // > 0 so the sweep actually runs
	s, _ := newRunnable(t, st, vec)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	// Startup event must reach the vector backend.
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return len(vec.upserts) >= 1
	}, time.Second, time.Millisecond, "the first sweep should run before the first tick")

	// Now enqueue a tick-driven event and wait for the next cycle.
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "live-1", snowflakeRV(200), minimalDashboard("live-1", "Live 1")))
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return len(vec.upserts) >= 2
	}, time.Second, time.Millisecond, "ticker should drain the queue")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}
}

// TestReconciler_ProcessBatch_RequeuesOnGetLatestRVFailure pins the
// processBatch failure path: if the checkpoint read fails we can't
// safely advance the cursor, so the drained batch goes back on the
// queue for the next cycle.
func TestReconciler_ProcessBatch_RequeuesOnGetLatestRVFailure(t *testing.T) {
	vec := newFakeVector()
	vec.latestRV = 50
	vec.getLatestRVErr = fmt.Errorf("transient checkpoint read failure")
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "a", 100, minimalDashboard("a", "A")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "b", 110, minimalDashboard("b", "B")))

	s.processPending(context.Background())

	assert.Empty(t, vec.upserts, "no upserts should happen when GetLatestRV errors")
	assert.Equal(t, int64(50), vec.latestRV, "cursor stays put on GetLatestRV failure")
	assert.Equal(t, 2, s.pendingLen(), "both events re-enqueued for the next cycle")
}

func labeledDashboard(uid, title string) []byte {
	body, _ := json.Marshal(map[string]any{
		"metadata": map[string]any{
			"name":   uid,
			"labels": map[string]any{controller.LabelPendingDelete: "true"},
		},
		"spec": map[string]any{"uid": uid, "title": title},
	})
	return body
}

func TestReconciler_PendingDeleteLabel_SkipsUpsert(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 100, labeledDashboard("dash-1", "Dash 1")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-2", 200, minimalDashboard("dash-2", "Dash 2")))

	s.processPending(context.Background())

	require.Len(t, vec.upserts, 1, "only the unlabeled resource should be embedded")
	assert.Equal(t, 1, text.calls, "skipped event must not call the embedder")
	assert.Equal(t, 0, s.pendingLen(), "skipped events are not retried")
}

func TestReconciler_PendingDeleteLabel_DeleteEventStillProcessed(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash-x", 50, nil))

	s.processPending(context.Background())

	require.Len(t, vec.deletes, 1, "deletes must still drop vectors regardless of labels")
}

func TestReconciler_PendingDeleteLabel_RestoreReembeds(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 100, labeledDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())
	require.Empty(t, vec.upserts, "labeled resource is skipped")

	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1")))
	s.processPending(context.Background())
	require.Len(t, vec.upserts, 1, "unlabeled (restored) resource embeds again")
}

// TestReconciler_Run_BroadcasterDeliversWatchEvents pins the watch
// path: Subscribe is called, events pushed onto the channel reach the
// queue, and the next cycle drains them.
func TestReconciler_Run_BroadcasterDeliversWatchEvents(t *testing.T) {
	vec := newFakeVector()
	s, _ := newRunnable(t, &fakeStorage{}, vec)
	bcast := newFakeBroadcaster()
	s.UseBroadcaster(bcast)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	// Subscribe should happen as part of Run startup.
	require.Eventually(t, func() bool {
		bcast.mu.Lock()
		defer bcast.mu.Unlock()
		return bcast.subscribeCalls == 1
	}, time.Second, time.Millisecond)

	bcast.emit(&resource.WrittenEvent{
		Type: resourcepb.WatchEvent_MODIFIED,
		Key: &resourcepb.ResourceKey{
			Group:     dashGroup,
			Resource:  dashRes,
			Namespace: "ns",
			Name:      "watched",
		},
		Value:           minimalDashboard("watched", "Watched"),
		ResourceVersion: snowflakeRV(500),
	})

	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return len(vec.upserts) >= 1
	}, time.Second, time.Millisecond, "watch event should reach the vector backend")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}

	bcast.mu.Lock()
	defer bcast.mu.Unlock()
	assert.NotNil(t, bcast.unsubscribeCh, "Unsubscribe must run on Run exit")
}

// TestReconciler_Run_BroadcasterSubscribeErrorContinues asserts the
// reconciler tolerates a broadcaster Subscribe failure: it logs and
// proceeds in poll-only mode rather than aborting Run. This matters
// for partial environments where the broadcaster isn't ready yet.
func TestReconciler_Run_BroadcasterSubscribeErrorContinues(t *testing.T) {
	vec := newFakeVector()
	s, _ := newRunnable(t, &fakeStorage{}, vec)
	bcast := newFakeBroadcaster()
	bcast.subscribeErr = fmt.Errorf("broadcaster not ready")
	s.UseBroadcaster(bcast)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	// Subscribe is attempted and lock is acquired even though Subscribe failed.
	require.Eventually(t, func() bool {
		bcast.mu.Lock()
		defer bcast.mu.Unlock()
		return bcast.subscribeCalls == 1
	}, time.Second, time.Millisecond)
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return vec.lockReleases == 0 && vec.lockAttempts >= 1
	}, time.Second, time.Millisecond, "lock acquired despite Subscribe error")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}
}

func TestReconciler_Run_LaunchesBackfiller(t *testing.T) {
	// Run drives the backfiller and waits for it on shutdown.
	vec := newFakeVector()
	bf := &fakeBackfiller{blocked: true}
	text := &fakeText{dim: 4}
	s, err := New(Options{
		Storage:           &fakeStorage{},
		VectorBackend:     vec,
		BatchEmbedder:     embedder.NewBatchEmbedder(*newFakeEmbedder(text)),
		Builders:          []embed.Builder{dashboard.New()},
		Backfiller:        bf,
		Interval:          5 * time.Millisecond,
		LockRetryInterval: 1 * time.Millisecond,
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx) }()

	require.Eventually(t, func() bool {
		return bf.runCount() == 1
	}, time.Second, time.Millisecond, "Run should launch the backfiller")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}
}

func TestReconciler_EnsureResourceInitialized_UsesEventRV(t *testing.T) {
	// Bounds the job by the triggering event's RV; idempotent per process.
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	b := dashboard.New()

	require.NoError(t, s.ensureResourceInitialized(context.Background(), b, snowflakeRV(777)))

	assert.Equal(t, []string{dashRes}, vec.ensuredPartitions)
	require.Len(t, vec.backfillJobs, 1)
	assert.Equal(t, dashRes, vec.backfillJobs[0].Resource)
	assert.Equal(t, testModel, vec.backfillJobs[0].Model)
	assert.Equal(t, snowflakeRV(777), vec.backfillJobs[0].StoppingRV)
	assert.Equal(t, b.Version(), vec.backfillJobs[0].ContentVersion, "job is stamped with the builder's content version")

	// Second event for the same resource: no-op (no new partition or job).
	require.NoError(t, s.ensureResourceInitialized(context.Background(), b, snowflakeRV(999)))
	assert.Len(t, vec.ensuredPartitions, 1)
	assert.Len(t, vec.backfillJobs, 1)
	assert.Equal(t, snowflakeRV(777), vec.backfillJobs[0].StoppingRV)
}

func TestReconciler_EnsureResourceInitialized_CreateError(t *testing.T) {
	// A CreateBackfillJob failure surfaces (and leaves the resource unmarked,
	// so the next event retries).
	vec := newFakeVector()
	vec.createBackfillErr = errors.New("db unavailable")
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	err := s.ensureResourceInitialized(context.Background(), dashboard.New(), snowflakeRV(1))
	require.Error(t, err)
	assert.Empty(t, vec.backfillJobs)
}

// The cursor may only move to an RV every builder proved complete, and
// it must move even when this builder saw nothing, or it ages off the
// event store and every later listing falls onto the full data-store
// scan.
func TestReconciler_Sweep_AdvancesCursor(t *testing.T) {
	widgets := fakeBuilder{group: "test.grafana.app", resource: "widgets"}
	dashAt := func(rv int64, name string) *resource.ModifiedResource {
		return dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name))
	}

	tests := []struct {
		name        string
		builders    []embed.Builder
		changes     []*resource.ModifiedResource
		itemErr     error
		snapshotRv  int64
		cursor      int64
		wantCursor  int64
		wantUpserts int
		wantPending int
	}{
		{
			name: "a write landing mid-walk does not lift the listing ceiling",
			changes: []*resource.ModifiedResource{
				dashAt(snowflakeRV(200), "dash-1"),
				dashAt(snowflakeRV(300), "dash-2"),
			},
			snapshotRv:  snowflakeRV(200),
			cursor:      snowflakeRV(50),
			wantCursor:  snowflakeRV(200),
			wantUpserts: 2,
		},
		{
			name: "no changes for this builder still rides the store's latest RV",
			changes: []*resource.ModifiedResource{
				dashAt(snowflakeRV(100), "dash-1"), // at the cursor, so skipped
				change("other.grafana.app", "others", "ns", "other-1", snowflakeRV(300), nil),
			},
			cursor:     snowflakeRV(100),
			wantCursor: snowflakeRV(300),
		},
		{
			name:       "interrupted walk proves nothing",
			changes:    []*resource.ModifiedResource{dashAt(snowflakeRV(100), "dash-1"), dashAt(snowflakeRV(200), "dash-2")},
			itemErr:    errBoom,
			cursor:     snowflakeRV(50),
			wantCursor: snowflakeRV(50),
		},
		{
			name:     "one builder's failure holds the cursor for all of them",
			builders: []embed.Builder{dashboard.New(), widgets},
			changes: []*resource.ModifiedResource{
				dashAt(snowflakeRV(200), "dash-1"),
				change(widgets.group, widgets.resource, "ns", "widget-1", snowflakeRV(150), []byte("boom")),
			},
			cursor:      snowflakeRV(50),
			wantCursor:  snowflakeRV(150) - 1,
			wantUpserts: 1,
			wantPending: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			st := &fakeStorage{changes: tc.changes, itemErr: tc.itemErr, itemErrI: 1, latestRvOverride: tc.snapshotRv}
			vec := newFakeVector()
			vec.latestRV = tc.cursor
			builders := tc.builders
			if builders == nil {
				builders = []embed.Builder{dashboard.New()}
			}
			s := newReconcilerWithBuilders(t, st, vec, builders...)

			s.sweep(t.Context())

			assert.Equal(t, tc.wantCursor, vec.latestRV, "cursor")
			assert.Len(t, vec.upserts, tc.wantUpserts, "upserts")
			assert.Equal(t, tc.wantPending, s.pendingLen(), "queued for retry")
		})
	}
}

// A watch copy that is newer than the listed one but still below the
// ceiling gets dropped by the live path once the cursor reaches that
// ceiling, so the walk cannot defer to it.
func TestReconciler_Sweep_EmbedsEventQueuedBelowTheCeiling(t *testing.T) {
	st := &fakeStorage{
		changes: []*resource.ModifiedResource{
			dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(90), minimalDashboard("dash-1", "Dash 1")),
		},
		latestRvOverride: snowflakeRV(100),
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	s, _ := newReconciler(t, st, vec)
	// Watch delivers a newer copy while the walk is running.
	st.onYield = func() {
		s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(95), minimalDashboard("dash-1", "Dash 1")))
	}

	s.sweep(t.Context())

	assert.Equal(t, snowflakeRV(100), vec.latestRV)
	assert.True(t, vec.hasUpsertFor("ns", dashRes, "dash-1"), "the walk must embed what the cursor is about to pass")
}

// A write in flight when the walk read its ceiling shows up below the
// cursor on the next sweep, inside the backend's lookback window. The
// walk has to embed it: nothing else ever will.
func TestReconciler_Sweep_EmbedsWriteRecoveredByLookback(t *testing.T) {
	st := &fakeStorage{
		changes:  []*resource.ModifiedResource{dashChange(resourcepb.WatchEvent_ADDED, "ns", "late", snowflakeRV(95), minimalDashboard("late", "Late"))},
		lookback: 10,
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(100)
	s, _ := newReconciler(t, st, vec)

	s.sweep(t.Context())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "late", vec.upserts[0][0].UID)
}

// A lookback-recovered write that fails on the first attempt keeps its
// retry budget. The next sweep skips the lookback window, so if the live
// path also discarded it for sitting below the cursor, nothing would ever
// embed it.
func TestReconciler_Sweep_RetriesFailedLookbackWrite(t *testing.T) {
	st := &fakeStorage{
		changes:  []*resource.ModifiedResource{dashChange(resourcepb.WatchEvent_ADDED, "ns", "late", snowflakeRV(95), minimalDashboard("late", "Late"))},
		lookback: 10,
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(100)
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, st, vec)

	s.reconcileCycle(t.Context())
	require.Equal(t, 1, s.pendingLen(), "the failed write is queued for retry")

	vec.upsertErr = nil
	s.reconcileCycle(t.Context())

	assert.True(t, vec.hasUpsertFor("ns", dashRes, "late"), "the retry must embed it")
	assert.Zero(t, s.pendingLen())
}

// A queued event that failed earlier must not be replayed over a newer
// revision the sweep has since indexed: the walk bypasses the pending
// map, so nothing else drops the stale copy.
func TestReconciler_StaleQueuedRetry_DoesNotOverwriteNewerEmbedding(t *testing.T) {
	st := &fakeStorage{
		changes:  []*resource.ModifiedResource{dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(150), multiPanelDashboard("dash-1", "New", 2))},
		lookback: 10,
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(100)
	s, _ := newReconciler(t, st, vec)

	// A lookback-recovered revision that failed on an earlier cycle.
	stale := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(95), minimalDashboard("dash-1", "Old"))
	stale.attempts = 1
	s.enqueue(stale)

	s.sweep(t.Context())
	indexed := vec.storedContentFor("ns", dashRes, "dash-1")
	require.NotEmpty(t, indexed, "the sweep indexed the newer revision")

	s.processPending(t.Context())

	assert.Equal(t, indexed, vec.storedContentFor("ns", dashRes, "dash-1"), "the newer revision survives")
}

// A write can reach the watch and the walk at the same RV. The walk must
// still embed it, because the cursor is about to move past that RV and
// the queued copy is discarded once it does.
func TestReconciler_Sweep_EmbedsEventAlreadyQueuedFromWatch(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")),
	}}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(99)
	s, _ := newReconciler(t, st, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")))

	s.sweep(t.Context())
	require.True(t, vec.hasUpsertFor("ns", dashRes, "dash-1"), "the walk must embed what the cursor is about to pass")
	require.Equal(t, snowflakeRV(100), vec.latestRV)

	assert.Zero(t, s.pendingLen(), "the queued copy is superseded by what the walk wrote")
	s.processPending(t.Context())
	assert.Len(t, vec.upserts, 1, "and is not written a second time")
}

// Delivery is at-most-once on the NATS notifier, so a write can never
// arrive. If the cursor moves on the strength of the events that did
// arrive, the missing one is jumped over and never looked at again.
func TestReconciler_Sweep_EmbedsEventWithheldFromWatch(t *testing.T) {
	st := &fakeStorage{}
	for i, name := range []string{"dash-100", "dash-101", "dash-102"} {
		st.changes = append(st.changes, dashChange(resourcepb.WatchEvent_ADDED, "ns", name,
			snowflakeRV(int64(100+i)), minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = snowflakeRV(99)
	s, _ := newReconciler(t, st, vec)

	// dash-101's event is dropped in transit; the other two arrive.
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-100", snowflakeRV(100), minimalDashboard("dash-100", "dash-100")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-102", snowflakeRV(102), minimalDashboard("dash-102", "dash-102")))

	s.reconcileCycle(t.Context())

	assert.True(t, vec.hasUpsertFor("ns", dashRes, "dash-101"),
		"the withheld write must be embedded by the sweep")
	assert.Equal(t, snowflakeRV(102), vec.latestRV, "cursor advances only once the sweep has covered the window")
}

// Draining live events must not move the cursor: the batch that arrived
// says nothing about the writes that did not. The one exception is a
// fleet that has never checkpointed, where the sweep needs a non-zero
// cursor to start from and gets one below the batch's lowest RV.
func TestReconciler_LiveBatch_CursorAdvance(t *testing.T) {
	tests := []struct {
		name       string
		cursor     int64
		wantCursor int64
	}{
		{name: "an established cursor is left alone", cursor: snowflakeRV(50), wantCursor: snowflakeRV(50)},
		{name: "a cursor of 0 is seeded below the batch", cursor: 0, wantCursor: snowflakeRV(100) - 1},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			vec := newFakeVector()
			vec.latestRV = tc.cursor
			s, _ := newReconciler(t, &fakeStorage{}, vec)

			s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")))
			s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-2", snowflakeRV(110), minimalDashboard("dash-2", "Dash 2")))
			s.processPending(t.Context())

			require.Len(t, vec.upserts, 2, "live events are still embedded promptly")
			assert.Equal(t, tc.wantCursor, vec.latestRV)
		})
	}
}

// A seeded cursor sits below the events that seeded it, so the sweep
// re-lists them rather than trusting the live path with them. Re-listing
// is free: same content, so the diff writes nothing.
func TestReconciler_Sweep_RelistsTheSeededBatch(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-a", snowflakeRV(100), minimalDashboard("dash-a", "dash-a")),
	}}
	vec := newFakeVector() // latestRV stays 0
	s, _ := newReconciler(t, st, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-a", snowflakeRV(100), minimalDashboard("dash-a", "dash-a")))
	s.processPending(t.Context())
	require.Equal(t, snowflakeRV(100)-1, vec.latestRV, "seeded below the batch")

	yielded := 0
	st.onYield = func() { yielded++ }
	s.sweep(t.Context())

	assert.Equal(t, 1, yielded, "the sweep re-lists the seeded event")
	assert.Len(t, vec.upserts, 1, "unchanged content is not re-embedded")
	assert.Equal(t, snowflakeRV(100), vec.latestRV)
}

// A repeat sweep at an unchanged cursor passes the previous call's
// timestamp, so the backend can skip its lookback window.
func TestReconciler_Sweep_SkipsLookbackOnRepeatSinceRv(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")),
	}}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(100) // already at the store's latest: the cursor won't move
	s, _ := newReconciler(t, st, vec)

	s.sweep(t.Context())
	s.sweep(t.Context())

	require.Len(t, st.lastCalledWith, 2)
	assert.Nil(t, st.lastCalledWith[0], "first sweep at this cursor needs the lookback")
	assert.NotNil(t, st.lastCalledWith[1], "repeat sweep at the same cursor can skip it")
}

// A failed seed leaves the cursor at 0, where the sweep cannot run at
// all, so the batch is kept and the seed retried on the next cycle
// rather than waiting for another write to arrive.
func TestReconciler_LiveBatch_RetriesFailedSeed(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")),
	}}
	vec := newFakeVector() // latestRV stays 0
	vec.setLatestRVErr = errBoom
	s, _ := newReconciler(t, st, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")))
	s.reconcileCycle(t.Context())

	require.Zero(t, vec.latestRV, "the seed write failed")
	require.Equal(t, 1, s.pendingLen(), "the batch is kept so the seed can be retried")

	vec.setLatestRVErr = nil
	s.reconcileCycle(t.Context())

	assert.Equal(t, snowflakeRV(100), vec.latestRV, "the retried seed lets the sweep run and advance")
}

// The retry cap exists so a permanently broken resource can't wedge the
// cursor. The sweep re-lists that resource from storage every interval,
// so it must not hand it a fresh retry budget each time.
func TestReconciler_Sweep_DoesNotResetExhaustedRetries(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "boom", snowflakeRV(100), minimalDashboard("boom", "Boom")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "ok", snowflakeRV(200), minimalDashboard("ok", "OK")),
	}}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	vec.upsertErrFn = func(vs []vector.Vector) error {
		for _, v := range vs {
			if v.UID == "boom" {
				return errBoom
			}
		}
		return nil
	}
	s, _ := newReconciler(t, st, vec)

	// Well past the budget: every cycle retries the queued copy and
	// re-lists the stored one.
	for range maxEventAttempts + 3 {
		s.reconcileCycle(t.Context())
	}

	assert.True(t, vec.hasUpsertFor("ns", dashRes, "ok"), "the healthy resource is embedded")
	assert.Equal(t, snowflakeRV(200), vec.latestRV, "cursor moves past the resource that exhausted its retries")
	assert.Zero(t, s.pendingLen(), "the broken resource is not queued again")
}

// The exhausted record is per (resource, RV): a newer write clears it so
// a resource that starts embedding again is not skipped forever.
func TestReconciler_ExhaustedRecord_ClearedByNewerRV(t *testing.T) {
	s, _ := newReconciler(t, &fakeStorage{}, newFakeVector())
	broken := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), nil)

	s.markExhausted(broken)
	assert.True(t, s.isExhausted(broken), "same RV stays exhausted")

	rewritten := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(200), nil)
	assert.False(t, s.isExhausted(rewritten), "a newer write gets a fresh budget")
	assert.False(t, s.isExhausted(broken), "and clears the record")
}

// The cursor moving past an exhausted RV is not enough to forget it: the
// backend lists from a lookback window behind the cursor, so the next
// sweep can hand the same event back and would give it a fresh budget.
// The record is dropped only once a sweep stops re-listing it.
func TestReconciler_ExhaustedRecord_SurvivesLookbackRelist(t *testing.T) {
	s, _ := newReconciler(t, &fakeStorage{}, newFakeVector())
	broken := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), nil)
	past := snowflakeRV(200)

	s.markExhausted(broken)

	s.forgetExhaustedBelow(past)
	assert.True(t, s.isExhausted(broken), "still skipped when the lookback re-lists it")

	s.forgetExhaustedBelow(past)
	assert.Len(t, s.exhausted, 1, "kept while sweeps keep re-listing it")

	s.forgetExhaustedBelow(past)
	assert.Empty(t, s.exhausted, "dropped once a sweep no longer lists it")
}

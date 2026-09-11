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

// dashEvent builds a reconcileEvent with the dashboard group/resource pre-filled.
func dashEvent(action resourcepb.WatchEvent_Type, ns, name string, rv int64, value []byte) *reconcileEvent {
	if rv > 0 && rv < 10000 {
		rv = snowflakeRV(rv)
	}
	return &reconcileEvent{
		action:    action,
		group:     dashGroup,
		resource:  dashRes,
		namespace: ns,
		name:      name,
		value:     value,
		rv:        rv,
	}
}

// addStoredEvent updates the storage fixture and delivers its bootstrap notification.
func addStoredEvent(t *testing.T, s *Reconciler, ev *reconcileEvent) {
	t.Helper()
	st := s.storage.(*fakeStorage)
	st.mu.Lock()
	stored := &resource.ModifiedResource{
		Key:    resourcepb.ResourceKey{Group: ev.group, Resource: ev.resource, Namespace: ev.namespace, Name: ev.name},
		Action: ev.action, ResourceVersion: ev.rv, Value: ev.value,
	}
	replaced := false
	for i, old := range st.changes {
		if old.Key.Group == ev.group && old.Key.Resource == ev.resource && old.Key.Namespace == ev.namespace && old.Key.Name == ev.name {
			if old.ResourceVersion <= ev.rv {
				st.changes[i] = stored
			}
			replaced = true
			break
		}
	}
	if !replaced {
		st.changes = append(st.changes, stored)
	}
	st.mu.Unlock()
	s.observeWrite(&resource.WrittenEvent{Key: &stored.Key, ResourceVersion: ev.rv, Type: ev.action, Value: ev.value})
}

func retryCount(s *Reconciler) int {
	n := 0
	for _, state := range s.retries {
		if state.attempts < maxEventAttempts {
			n++
		}
	}
	return n
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

func TestReconciler_UnseededSweep_NoOp(t *testing.T) {
	st := &fakeStorage{}
	vec := newFakeVector()
	s, text := newReconciler(t, st, vec)

	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns-a", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns-b", "dash-2", 200, minimalDashboard("dash-2", "Dash 2")))

	s.sweep(context.Background())

	assert.Equal(t, 2, text.calls, "one EmbedText call per dashboard")
	require.Len(t, vec.upserts, 2, "one Upsert per dashboard")
}

func TestReconciler_HappyPath_StampsBuilderVersion(t *testing.T) {
	// Upserted vectors carry the builder's content-format version, not
	// whatever the RV or an arbitrary literal happens to be.
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))

	s.sweep(context.Background())

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
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "big", 100, multiPanelDashboard("big", "Big Dash", 12)))

	s.sweep(context.Background())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	assert.Len(t, vec.upserts[0], 12, "12 panels = 12 vectors in the upsert")
}

func TestReconciler_DeleteEvent_CallsVectorDelete(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash-x", 50, nil))

	s.sweep(context.Background())

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
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, threePanelDashboard("Mem")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Len(t, vec.upserts[0], 3, "first write embeds all three panels")
	require.Equal(t, 1, text.calls)

	// Only panel/2's title changes.
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, threePanelDashboard("Memory")))
	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, 1, text.calls)

	// Re-process byte-identical content at a higher RV.
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, dashboardInFolder("dash-1", "Dash", "folder-a")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, "folder-a", vec.upserts[0][0].Folder)
	require.Equal(t, 1, text.calls)

	// Move to folder-b; panel content is identical.
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, dashboardInFolder("dash-1", "Dash", "folder-b")))
	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, dashboardInFolder("dash-1", "Dash", "folder-a")))
	s.sweep(context.Background())

	require.Len(t, vec.upserts, 1)
	require.NotEmpty(t, vec.upserts[0])
	assert.Contains(t, vec.upserts[0][0].Content, "Production → Dash")
}

// TestReconciler_FolderTitleResolveError_BlocksAdvance covers the retry
// contract: a folder-title storage error is treated like any other
// per-event failure — it blocks the cursor and retains retry metadata, rather
// than being swallowed.
func TestReconciler_FolderTitleResolveError_BlocksAdvance(t *testing.T) {
	vec := newFakeVector()
	storage := &fakeStorage{readErr: errBoom}
	s, text := newReconciler(t, storage, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, dashboardInFolder("dash-1", "Dash", "folder-a")))
	s.sweep(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Equal(t, 0, text.calls, "resolver error must short-circuit before embedding")

	_, hasPending := s.retries[retryKey(dashGroup, dashRes, "ns", "dash-1")]
	assert.True(t, hasPending, "resolver error retains retry metadata for retry")
}

// A panel removed with no other change must delete the stale row without
// embedding anything (empty changed, non-empty desired).
func TestReconciler_PartialReembed_DeleteOnly(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, threePanelDashboard("Mem")))
	s.sweep(context.Background())
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
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, twoPanel))
	s.sweep(context.Background())

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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, collide))
	s.sweep(context.Background())
	require.Equal(t, 1, text.calls)

	// A stale subresource that no longer exists in the dashboard.
	vec.storedSubs[subsKey("ns", testModel, dashRes, "dash-1")]["panel/9"] = "stale"

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, collide))
	s.sweep(context.Background())

	require.Len(t, vec.delsubs, 1, "stale row deleted despite the subresource collision")
	assert.ElementsMatch(t, []string{"panel/9"}, vec.delsubs[0].Subresources)
}

// A newer stored revision is picked up by the next sweep.
func TestReconciler_SameResourceHigherRV_ReembedsNextCycle(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, 1, text.calls)

	// Same dashboard at a higher RV: dedup keeps the new one.
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1 v2")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 2)
	require.Equal(t, 2, text.calls)
}

func TestReconciler_UnknownAction_BlocksAdvance(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	addStoredEvent(t, s, &reconcileEvent{
		action:    resourcepb.WatchEvent_BOOKMARK,
		group:     dashGroup,
		resource:  dashRes,
		namespace: "ns",
		name:      "weird",
		rv:        snowflakeRV(50),
	})
	s.sweep(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.deletes)
	assert.Equal(t, 0, text.calls)
	assert.Equal(t, snowflakeRV(50)-1, vec.latestRV, "checkpoint stops at (failed - 1)")
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
	s.sweep(context.Background())

	assert.Empty(t, vec.upserts, "the sweep is a no-op when cursor is 0")
	assert.Equal(t, 0, text.calls)
}

func TestReconciler_Sweep_PullsCrossNamespaceEvents(t *testing.T) {
	// Cursor non-zero → the sweep walks every namespace in one pass via
	// cross-namespace ListModifiedSince, processes each event,
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
	s.sweep(context.Background())

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
	s.sweep(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new", vec.upserts[0][0].UID)
}

// ---------- Watch path ----------

// ---------- Dedup ----------

// Storage filters stale revisions when listing from the checkpoint.
func TestReconciler_FiltersEventsAtOrBelowCursor(t *testing.T) {
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(150)
	s, text := newReconciler(t, &fakeStorage{}, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "old", snowflakeRV(100), minimalDashboard("old", "Old")))
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "new", snowflakeRV(200), minimalDashboard("new", "New")))

	s.sweep(t.Context())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new", vec.upserts[0][0].UID)

	// A late copy of "new" from below the cursor must not replace what is
	// already indexed for it.
	indexed := vec.storedContentFor("ns", dashRes, "new")
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "new", snowflakeRV(140), minimalDashboard("new", "Stale")))
	s.sweep(t.Context())

	assert.Len(t, vec.upserts, 1, "the stale copy is not embedded")
	assert.Equal(t, indexed, vec.storedContentFor("ns", dashRes, "new"), "indexed content untouched")
}

// ---------- Retry cap ----------

func TestReconciler_RetryCap_DropsEventAfterMaxAttempts(t *testing.T) {
	vec := newFakeVector()
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "boom", 100, minimalDashboard("boom", "Boom")))

	for range maxEventAttempts {
		s.sweep(context.Background())
	}

	require.Equal(t, 0, retryCount(s), "event dropped after max attempts")
	assert.Empty(t, vec.upserts)

	// A subsequent healthy event proves the reconciler is unblocked.
	vec.upsertErr = nil
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns-other", "ok", 200, minimalDashboard("ok", "OK")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 1)
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

func TestReconciler_Sweep_CheckpointsAfterFullListing(t *testing.T) {
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

	require.Len(t, vec.upserts, 7, "every listed resource must be processed")
	assert.Equal(t, snowflakeRV(160), vec.latestRV, "cursor advances to highest RV")
	assert.Equal(t, 0, retryCount(s), "no retries after startup")
	assert.Equal(t, 1, vec.setLatestRVCalls, "cursor advances exactly once at end of startup")
}

// Advancing mid-listing would skip the lower RVs yielded later.
func TestReconciler_Sweep_DescOrderDoesNotDropEvents(t *testing.T) {
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

	assert.Len(t, vec.upserts, 6, "every event embedded in descending RV order")
	assert.Equal(t, snowflakeRV(150), vec.latestRV)
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
	assert.Zero(t, retryCount(s), "nothing queued; the next walk re-proves the RV")

	vec.setLatestRVErr = nil
	s.sweep(t.Context())

	assert.Equal(t, snowflakeRV(100), vec.latestRV, "the next sweep advances the cursor")
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
		{"failure above snapshot cannot lift ceiling", 50, 200, 300, 200},
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

	// The next sweep discovers the new stored resource.
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "live-1", snowflakeRV(200), minimalDashboard("live-1", "Live 1")))
	require.Eventually(t, func() bool {
		vec.mu.Lock()
		defer vec.mu.Unlock()
		return len(vec.upserts) >= 2
	}, time.Second, time.Millisecond, "ticker should sweep the new write")

	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("Run did not exit after ctx cancel")
	}
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

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 100, labeledDashboard("dash-1", "Dash 1")))
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-2", 200, minimalDashboard("dash-2", "Dash 2")))

	s.sweep(context.Background())

	require.Len(t, vec.upserts, 1, "only the unlabeled resource should be embedded")
	assert.Equal(t, 1, text.calls, "skipped event must not call the embedder")
	assert.Equal(t, 0, retryCount(s), "skipped events are not retried")
}

func TestReconciler_PendingDeleteLabel_DeleteEventStillProcessed(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash-x", 50, nil))

	s.sweep(context.Background())

	require.Len(t, vec.deletes, 1, "deletes must still drop vectors regardless of labels")
}

func TestReconciler_PendingDeleteLabel_RestoreReembeds(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 100, labeledDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())
	require.Empty(t, vec.upserts, "labeled resource is skipped")

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1")))
	s.sweep(context.Background())
	require.Len(t, vec.upserts, 1, "unlabeled (restored) resource embeds again")
}

// TestReconciler_Run_BroadcasterSeedsSweep pins the watch
// path: Subscribe is called, events pushed onto the channel reach the
// queue, and the next cycle drains them.
func TestReconciler_Run_BroadcasterSeedsSweep(t *testing.T) {
	vec := newFakeVector()
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_MODIFIED, "ns", "watched", snowflakeRV(500), minimalDashboard("watched", "Watched")),
	}}
	s, _ := newRunnable(t, st, vec)
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
			name:        "interrupted walk proves nothing",
			changes:     []*resource.ModifiedResource{dashAt(snowflakeRV(100), "dash-1"), dashAt(snowflakeRV(200), "dash-2")},
			itemErr:     errBoom,
			cursor:      snowflakeRV(50),
			wantCursor:  snowflakeRV(50),
			wantUpserts: 1,
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
			assert.Equal(t, tc.wantPending, retryCount(s), "awaiting retry")
		})
	}
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

// A failed lookback write must remain visible to the next sweep.
func TestReconciler_Sweep_RetriesFailedLookbackWrite(t *testing.T) {
	st := &fakeStorage{
		changes:  []*resource.ModifiedResource{dashChange(resourcepb.WatchEvent_ADDED, "ns", "late", snowflakeRV(95), minimalDashboard("late", "Late"))},
		lookback: 10,
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(100)
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, st, vec)

	s.sweep(t.Context())
	require.Equal(t, 1, retryCount(s), "the failed write is awaiting retry")

	vec.upsertErr = nil
	s.sweep(t.Context())

	assert.True(t, vec.hasUpsertFor("ns", dashRes, "late"), "the retry must embed it")
	assert.Zero(t, retryCount(s))
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
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-100", snowflakeRV(100), minimalDashboard("dash-100", "dash-100")))
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-102", snowflakeRV(102), minimalDashboard("dash-102", "dash-102")))

	s.sweep(t.Context())

	assert.True(t, vec.hasUpsertFor("ns", dashRes, "dash-101"),
		"the withheld write must be embedded by the sweep")
	assert.Equal(t, snowflakeRV(102), vec.latestRV, "cursor advances only once the sweep has covered the window")
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
// all, so its seed RV is retained until the write succeeds.
func TestReconciler_Sweep_RetriesFailedSeed(t *testing.T) {
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")),
	}}
	vec := newFakeVector() // latestRV stays 0
	vec.setLatestRVErr = errBoom
	s, _ := newReconciler(t, st, vec)

	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", snowflakeRV(100), minimalDashboard("dash-1", "Dash 1")))
	s.sweep(t.Context())

	require.Zero(t, vec.latestRV, "the seed write failed")
	require.Equal(t, snowflakeRV(100), s.seedRV, "only the seed RV is retained")

	vec.setLatestRVErr = nil
	s.sweep(t.Context())

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

	// Re-listing must not give a broken revision a fresh budget.
	for range maxEventAttempts + 3 {
		s.sweep(t.Context())
	}

	assert.True(t, vec.hasUpsertFor("ns", dashRes, "ok"), "the healthy resource is embedded")
	assert.Equal(t, snowflakeRV(200), vec.latestRV, "cursor moves past the resource that exhausted its retries")
	assert.Zero(t, retryCount(s), "the broken resource is no longer awaiting retry")
}

func setupEmbeddingRetry(t *testing.T, cursor int64) (*Reconciler, *fakeStorage, *fakeVector, *fakeText) {
	t.Helper()
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash", snowflakeRV(100), minimalDashboard("dash", "Dash")),
	}}
	vec := newFakeVector()
	vec.latestRV = cursor
	s, text := newReconciler(t, st, vec)
	return s, st, vec, text
}

func TestReconciler_EmbeddingBackoff(t *testing.T) {
	for _, hint := range []time.Duration{0, time.Second, 10 * time.Minute} {
		t.Run(hint.String(), func(t *testing.T) {
			s, st, vec, text := setupEmbeddingRetry(t, snowflakeRV(50))
			addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", snowflakeRV(100), st.changes[0].Value))
			for attempt := range maxEventAttempts - 1 {
				s.embedRetryAt = time.Time{}
				text.failNext = &embedder.RetryableError{Err: errBoom, RetryAfter: hint}
				before := time.Now()
				s.sweep(t.Context())
				require.Equal(t, attempt+1, text.calls)
				require.Equal(t, snowflakeRV(50), vec.latestRV)
				require.Equal(t, attempt+1, s.retries[retryKey(dashGroup, dashRes, "ns", "dash")].attempts)
				require.Equal(t, attempt+1, s.embedBackoff.NumRetries())
				assert.False(t, s.embedRetryAt.Before(before.Add(min(5*time.Minute, max(hint, time.Minute)))))
				assert.True(t, s.embedRetryAt.Before(time.Now().Add(5*time.Minute)), "provider hints cannot exceed the hard cap")
				s.sweep(t.Context())
				require.Equal(t, attempt+1, text.calls, "cooldown suppresses calls")
				require.Len(t, st.lastCalledWith, attempt+1, "cooldown suppresses additional scans")
			}
			s.embedRetryAt = time.Time{}
			s.sweep(t.Context())
			assert.Equal(t, snowflakeRV(100), vec.latestRV)
			assert.Zero(t, retryCount(s))
			assert.Nil(t, s.embedBackoff, "recovery resets backoff")
			assert.Len(t, vec.upserts, 1)
		})
	}
}

func TestReconciler_WatchOnlySeedsCheckpoint(t *testing.T) {
	s, st, vec, text := setupEmbeddingRetry(t, 0)
	key := &resourcepb.ResourceKey{Group: dashGroup, Resource: dashRes, Namespace: "ns", Name: "dash"}
	for _, ev := range []*resource.WrittenEvent{
		nil, {}, {Key: key}, {Key: &resourcepb.ResourceKey{Group: dashGroup, Resource: dashRes}, ResourceVersion: snowflakeRV(1)},
		{Key: &resourcepb.ResourceKey{Group: "other", Resource: "others", Namespace: "ns"}, ResourceVersion: snowflakeRV(1)},
	} {
		s.observeWrite(ev)
	}
	require.Zero(t, s.seedRV)
	for i := 10000; i >= 100; i-- {
		key.Name = fmt.Sprintf("dash-%d", i)
		s.observeWrite(&resource.WrittenEvent{Key: key, ResourceVersion: snowflakeRV(int64(i)), Value: []byte("invalid watch payload")})
	}
	require.Equal(t, snowflakeRV(100), s.seedRV)
	require.Empty(t, s.retries)
	require.Zero(t, text.calls)
	s.sweep(t.Context())
	require.Equal(t, snowflakeRV(100), vec.latestRV)
	require.Len(t, vec.upserts, 1, "embedding reads the valid storage payload")
	require.Zero(t, s.seedRV)
	s.observeWrite(&resource.WrittenEvent{Key: key, ResourceVersion: snowflakeRV(50), Value: st.changes[0].Value})
	assert.Zero(t, s.seedRV, "established checkpoint ignores further watch notifications")
}

func TestReconciler_Sweep_ProcessesBeforeReadingNextResource(t *testing.T) {
	s, st, vec, _ := setupEmbeddingRetry(t, snowflakeRV(50))
	st.changes = nil
	for i := range 6 {
		name := fmt.Sprintf("dash-%d", i)
		st.changes = append(st.changes, dashChange(resourcepb.WatchEvent_ADDED, "ns", name,
			snowflakeRV(int64(100+i)), minimalDashboard(name, name)))
	}
	yielded := 0
	st.onYield = func() { yielded++ }
	var atUpsert []int
	vec.onUpsert = func() { atUpsert = append(atUpsert, yielded) }
	s.sweep(t.Context())
	assert.Equal(t, []int{1, 2, 3, 4, 5, 6}, atUpsert)
	assert.Empty(t, s.retries)
}

func TestReconciler_Sweep_LookbackRecovery(t *testing.T) {
	for _, tt := range []struct {
		name    string
		failure error
		restart bool
	}{
		{"insertion failure", errBoom, false},
		{"provider cooldown", &embedder.RetryableError{Err: errBoom}, false},
		{"restart after insertion failure", errBoom, true},
		{"restart during provider cooldown", &embedder.RetryableError{Err: errBoom}, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s, st, vec, text := setupEmbeddingRetry(t, snowflakeRV(105))
			st.lookback, st.latestRvOverride = 10, snowflakeRV(110)
			var retryErr *embedder.RetryableError
			if errors.As(tt.failure, &retryErr) {
				text.failNext = tt.failure
			} else {
				vec.upsertErr = tt.failure
			}
			s.sweep(t.Context())
			require.Equal(t, snowflakeRV(105), vec.latestRV)
			vec.upsertErr = nil
			if tt.restart {
				s, text = newReconciler(t, st, vec)
			}
			s.embedRetryAt = time.Time{}
			s.sweep(t.Context())
			assert.Nil(t, st.lastCalledWith[1], "failed lookback must be listed again")
			assert.Equal(t, snowflakeRV(110), vec.latestRV)
			assert.Len(t, vec.upserts, 1)
			assert.Empty(t, s.retries)
			assert.Positive(t, text.calls)
		})
	}
}

func TestReconciler_Sweep_RetryReadsNewRevision(t *testing.T) {
	for _, action := range []resourcepb.WatchEvent_Type{resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED} {
		t.Run(action.String(), func(t *testing.T) {
			s, st, vec, _ := setupEmbeddingRetry(t, snowflakeRV(50))
			vec.upsertErr = errBoom
			for range maxEventAttempts - 1 {
				s.sweep(t.Context())
			}
			require.Equal(t, maxEventAttempts-1, s.retries[retryKey(dashGroup, dashRes, "ns", "dash")].attempts)
			st.changes[0] = dashChange(action, "ns", "dash", snowflakeRV(110), multiPanelDashboard("dash", "New", 2))
			s.sweep(t.Context())
			if action == resourcepb.WatchEvent_MODIFIED {
				require.Equal(t, 1, s.retries[retryKey(dashGroup, dashRes, "ns", "dash")].attempts, "new RV gets a fresh budget")
				vec.upsertErr = nil
				s.sweep(t.Context())
				require.Len(t, vec.upserts, 1)
				assert.Len(t, vec.upserts[0], 2, "new payload is read instead of replaying the failed one")
			} else {
				assert.Empty(t, vec.upserts)
				require.Len(t, vec.deletes, 1)
			}
			assert.Empty(t, s.retries)
			assert.Equal(t, snowflakeRV(110), vec.latestRV)
		})
	}
}

func TestReconciler_Sweep_ExhaustedLookbackIsNotRetried(t *testing.T) {
	s, st, vec, _ := setupEmbeddingRetry(t, snowflakeRV(105))
	st.lookback, st.latestRvOverride = 20, snowflakeRV(110)
	vec.upsertErr = errBoom
	for range maxEventAttempts {
		s.sweep(t.Context())
	}
	require.Equal(t, snowflakeRV(110), vec.latestRV)
	require.Len(t, s.retries, 1)
	s.sweep(t.Context())
	require.Len(t, s.retries, 1, "exhausted record survives a lookback relist")
	s.sweep(t.Context())
	assert.Empty(t, s.retries, "record is forgotten after a completed sweep no longer lists it")
	assert.Equal(t, snowflakeRV(110), vec.latestRV)
}

func TestReconciler_Sweep_PermanentErrorAfterProviderCooldown(t *testing.T) {
	s, _, vec, text := setupEmbeddingRetry(t, snowflakeRV(50))
	text.failNext = &embedder.RetryableError{Err: errBoom}
	s.sweep(t.Context())
	require.Equal(t, 1, s.retries[retryKey(dashGroup, dashRes, "ns", "dash")].attempts)
	s.embedRetryAt = time.Time{}
	vec.upsertErr = errBoom
	for attempt := 2; attempt <= maxEventAttempts; attempt++ {
		s.sweep(t.Context())
		require.Equal(t, attempt, s.retries[retryKey(dashGroup, dashRes, "ns", "dash")].attempts)
	}
	assert.Equal(t, snowflakeRV(100), vec.latestRV, "provider and permanent errors share one allowance")
}

func TestReconciler_Sweep_InterruptedRecovery(t *testing.T) {
	for _, failure := range []string{"provider", "iterator", "cancellation"} {
		t.Run(failure, func(t *testing.T) {
			s, st, vec, text := setupEmbeddingRetry(t, snowflakeRV(105))
			st.changes = nil
			st.lookback, st.latestRvOverride = 20, snowflakeRV(120)
			for i, name := range []string{"a", "b", "c"} {
				st.changes = append(st.changes, dashChange(resourcepb.WatchEvent_ADDED, "ns", name,
					snowflakeRV(int64(100+i*10)), minimalDashboard(name, name)))
			}
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			vec.upsertErrFn = func(v []vector.Vector) error {
				if v[0].UID == "a" {
					return errBoom
				}
				if failure == "cancellation" {
					cancel()
				}
				if failure == "provider" {
					text.failNext = &embedder.RetryableError{Err: errBoom}
				}
				return nil
			}
			if failure == "iterator" {
				st.itemErr, st.itemErrI = errBoom, 2
			}
			s.sweep(ctx)
			require.Equal(t, snowflakeRV(105), vec.latestRV)
			require.Equal(t, 1, s.retries[retryKey(dashGroup, dashRes, "ns", "a")].attempts)
			indexed, calls := len(vec.upserts), text.calls
			vec.upsertErrFn, st.itemErr = nil, nil
			s.embedRetryAt = time.Time{}
			s.sweep(t.Context())
			assert.Nil(t, st.lastCalledWith[1], "interrupted sweep keeps the lookback window")
			assert.Equal(t, 3-indexed, text.calls-calls, "successful content is not re-embedded")
			assert.Len(t, vec.upserts, 3)
			assert.Empty(t, s.retries)
			assert.Equal(t, snowflakeRV(120), vec.latestRV)
		})
	}
}

func TestReconciler_Sweep_SeedSurvivesProviderFailure(t *testing.T) {
	s, st, vec, text := setupEmbeddingRetry(t, 0)
	addStoredEvent(t, s, dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", snowflakeRV(100), st.changes[0].Value))
	text.failNext = &embedder.RetryableError{Err: errBoom}
	s.sweep(t.Context())
	require.Equal(t, snowflakeRV(100)-1, vec.latestRV)
	s, _ = newReconciler(t, st, vec)
	s.sweep(t.Context())
	assert.Len(t, vec.upserts, 1)
	assert.Equal(t, snowflakeRV(100), vec.latestRV)
}

func TestReconciler_Sweep_CheckpointReadFailure(t *testing.T) {
	s, _, vec, text := setupEmbeddingRetry(t, snowflakeRV(50))
	vec.getLatestRVErr = errBoom
	s.sweep(t.Context())
	assert.Zero(t, text.calls)
	assert.Empty(t, s.retries)
	assert.Equal(t, snowflakeRV(50), vec.latestRV)
	vec.getLatestRVErr = nil
	s.sweep(t.Context())
	assert.Len(t, vec.upserts, 1)
	assert.Equal(t, snowflakeRV(100), vec.latestRV)
}

func TestReconciler_EmbeddingRetryCap(t *testing.T) {
	for _, lookback := range []bool{false, true} {
		t.Run(fmt.Sprint(lookback), func(t *testing.T) {
			cursor := snowflakeRV(50)
			if lookback {
				cursor = snowflakeRV(105)
			}
			s, st, vec, text := setupEmbeddingRetry(t, cursor)
			st.lookback, st.latestRvOverride = 10, snowflakeRV(110)
			s.metrics = resource.ProvideVectorMetrics(prometheus.NewPedanticRegistry())
			key := retryKey(dashGroup, dashRes, "ns", "dash")
			for attempt := range maxEventAttempts {
				s.embedRetryAt = time.Time{}
				text.failNext = &embedder.RetryableError{Err: errBoom}
				s.sweep(t.Context())
				require.Equal(t, attempt+1, text.calls)
				require.Equal(t, cursor, vec.latestRV)
				require.Equal(t, attempt+1, s.retries[key].attempts)
			}
			assert.Equal(t, 1.0, testutil.ToFloat64(s.metrics.ReconcilerEventsDroppedTotal.WithLabelValues(dashGroup, dashRes, "retries_exhausted")))
			s.sweep(t.Context())
			require.Equal(t, maxEventAttempts, text.calls, "cooldown applies after exhaustion")
			st.changes = append(st.changes, dashChange(resourcepb.WatchEvent_ADDED, "ns", "next", snowflakeRV(110), minimalDashboard("next", "Next")))
			s.embedRetryAt = time.Time{}
			s.sweep(t.Context())
			require.Len(t, vec.upserts, 1)
			assert.Equal(t, "next", vec.upserts[0][0].UID, "unprocessed resources remain recoverable through storage")
			assert.Equal(t, maxEventAttempts+1, text.calls, "exhausted resource is not retried")
			assert.Equal(t, snowflakeRV(110), vec.latestRV)
		})
	}
}

func TestReconciler_BootstrapExceptions(t *testing.T) {
	for _, mode := range []string{"latest update", "latest delete", "insert failure", "read failure", "provider cooldown", "seed failure"} {
		t.Run(mode, func(t *testing.T) {
			s, st, vec, text := setupEmbeddingRetry(t, 0)
			late := dashChange(resourcepb.WatchEvent_MODIFIED, "ns", "late", snowflakeRV(90), multiPanelDashboard("late", "Latest", 2))
			if mode == "latest delete" {
				late.Action = resourcepb.WatchEvent_DELETED
			}
			st.changes = append(st.changes, late)
			s.observeWrite(&resource.WrittenEvent{Key: &st.changes[0].Key, ResourceVersion: snowflakeRV(100)})
			injected := false
			vec.onSetLatestRV = func(rv int64) {
				if injected {
					return
				}
				injected = true
				require.Equal(t, snowflakeRV(100)-1, rv)
				// This notification arrives after the seed was copied but before it persists.
				delivered := make(chan struct{})
				go func() {
					s.observeWrite(&resource.WrittenEvent{Key: &late.Key, ResourceVersion: snowflakeRV(80), Value: []byte("stale watch payload")})
					s.observeWrite(&resource.WrittenEvent{Key: &late.Key, ResourceVersion: snowflakeRV(85)})
					close(delivered)
				}()
				select {
				case <-delivered:
				case <-time.After(time.Second):
					t.Fatal("watch delivery blocked during seed persistence")
				}
				require.Len(t, s.bootstrap, 1, "notifications deduplicate without saving payloads")
			}
			switch mode {
			case "insert failure":
				vec.upsertErr = errBoom
			case "read failure":
				st.readErr = errBoom
			case "provider cooldown":
				text.failNext = &embedder.RetryableError{Err: errBoom}
			case "seed failure":
				vec.setLatestRVErr = errBoom
			}
			s.sweep(t.Context())
			if mode != "latest update" && mode != "latest delete" {
				require.Len(t, s.bootstrap, 1, "failure keeps the exception")
				vec.upsertErr, vec.setLatestRVErr, st.readErr = nil, nil, nil
				s.embedRetryAt = time.Time{}
				s.sweep(t.Context())
			}
			assert.Empty(t, s.bootstrap)
			assert.Equal(t, snowflakeRV(100), vec.latestRV)
			require.Len(t, vec.backfillJobs, 1)
			// A failed seed can be retried at the lower RV; otherwise the original
			// checkpoint must remain covered by the backfill.
			if mode != "seed failure" {
				assert.GreaterOrEqual(t, vec.backfillJobs[0].StoppingRV, snowflakeRV(100)-1)
			}
			if mode == "latest delete" {
				require.Len(t, vec.deletes, 1)
				assert.Equal(t, "late", vec.deletes[0].UID)
			} else {
				require.True(t, vec.hasUpsertFor("ns", dashRes, "late"))
				for _, batch := range vec.upserts {
					if batch[0].UID == "late" {
						assert.Len(t, batch, 2, "reads current content instead of replaying the notification")
						assert.Equal(t, snowflakeRV(90), batch[0].ResourceVersion)
					}
				}
			}
		})
	}
}

func TestReconciler_BootstrapExceptionBatchDoesNotBlockSweep(t *testing.T) {
	s, st, vec, _ := setupEmbeddingRetry(t, 0)
	st.changes[0].ResourceVersion = snowflakeRV(10000)
	s.observeWrite(&resource.WrittenEvent{Key: &st.changes[0].Key, ResourceVersion: snowflakeRV(10000)})
	vec.onSetLatestRV = func(rv int64) {
		if rv != snowflakeRV(10000)-1 {
			return
		}
		for i := range bootstrapBatchSize + 3 {
			name := fmt.Sprintf("late-%d", i)
			item := dashChange(resourcepb.WatchEvent_MODIFIED, "ns", name, snowflakeRV(int64(100+i)), minimalDashboard(name, name))
			st.changes = append(st.changes, item)
			s.observeWrite(&resource.WrittenEvent{Key: &item.Key, ResourceVersion: item.ResourceVersion})
		}
	}
	s.sweep(t.Context())
	assert.Len(t, s.bootstrap, 3)
	assert.Len(t, vec.upserts, bootstrapBatchSize+1)
	assert.True(t, vec.hasUpsertFor("ns", dashRes, "dash"), "normal listing still progresses")
	assert.Equal(t, snowflakeRV(10000), vec.latestRV)
	s.sweep(t.Context())
	assert.Empty(t, s.bootstrap)
	assert.Len(t, vec.upserts, bootstrapBatchSize+4)
}

func TestReconciler_BootstrapExceptionRetryCap(t *testing.T) {
	for _, mode := range []string{"read", "insert", "provider"} {
		t.Run(mode, func(t *testing.T) {
			s, st, vec, text := setupEmbeddingRetry(t, 0)
			late := dashChange(resourcepb.WatchEvent_MODIFIED, "ns", "late", snowflakeRV(90), minimalDashboard("late", "Late"))
			st.changes = append(st.changes, late)
			s.observeWrite(&resource.WrittenEvent{Key: &st.changes[0].Key, ResourceVersion: snowflakeRV(100)})
			vec.onSetLatestRV = func(rv int64) {
				if rv == snowflakeRV(100)-1 {
					s.observeWrite(&resource.WrittenEvent{Key: &late.Key, ResourceVersion: snowflakeRV(80)})
				}
			}
			if mode == "read" {
				st.readErr = errBoom
			}
			if mode == "insert" {
				vec.upsertErrFn = func(v []vector.Vector) error {
					if v[0].UID == "late" {
						return errBoom
					}
					return nil
				}
			}
			for attempt := range maxEventAttempts {
				if mode == "provider" {
					text.failNext = &embedder.RetryableError{Err: errBoom}
				}
				s.embedRetryAt = time.Time{}
				s.sweep(t.Context())
				if attempt < maxEventAttempts-1 {
					require.Len(t, s.bootstrap, 1)
					require.Equal(t, attempt+1, s.retries[retryKey(dashGroup, dashRes, "ns", "late")].attempts)
				}
			}
			assert.Empty(t, s.bootstrap, "exhaustion removes the exception")
			st.readErr, vec.upsertErrFn = nil, nil
			s.embedRetryAt = time.Time{}
			s.sweep(t.Context())
			assert.True(t, vec.hasUpsertFor("ns", dashRes, "dash"))
			assert.False(t, vec.hasUpsertFor("ns", dashRes, "late"))
		})
	}
}

func TestReconciler_BootstrapExceptionSurvivesOlderLookback(t *testing.T) {
	s, st, vec, _ := setupEmbeddingRetry(t, snowflakeRV(105))
	st.changes[0].ResourceVersion = snowflakeRV(90)
	key := retryKey(dashGroup, dashRes, "ns", "dash")
	s.bootstrap[key] = bootstrapEvent{key: &st.changes[0].Key, rv: snowflakeRV(90)}
	older := dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash", snowflakeRV(80), minimalDashboard("dash", "Older"))
	failed, abort := s.processListedEvent(t.Context(), dashboard.New(), older)
	require.False(t, failed)
	require.False(t, abort)
	require.Len(t, s.bootstrap, 1, "older lookback cannot discharge the newer exception")
	require.False(t, s.processBootstrap(t.Context(), snowflakeRV(105)))
	assert.Empty(t, s.bootstrap)
	require.Len(t, vec.upserts, 2)
	assert.Equal(t, snowflakeRV(90), vec.upserts[1][0].ResourceVersion)
}

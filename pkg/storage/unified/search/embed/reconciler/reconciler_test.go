package reconciler

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

const dashGroup = "dashboard.grafana.app"
const dashRes = "dashboards"
const testModel = "test-model"

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
	for i := 0; i < n; i++ {
		panels[i] = map[string]any{"id": i + 1, "title": uid, "description": "panel"}
	}
	body, _ := json.Marshal(map[string]any{"uid": uid, "title": title, "panels": panels})
	return body
}

// newReconciler builds a Reconciler without running startupReconcile. Tests that
// want startupReconcile should set vec.latestRV first (so startupReconcile doesn't
// short-circuit on RV=0) and call s.startupReconcile(ctx) explicitly.
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

	s.processQueue(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.deletes)
	assert.Equal(t, 0, text.calls)
	assert.Equal(t, int64(0), vec.latestRV)
}

func TestReconciler_HappyPath_PerDashboardEmbed(t *testing.T) {
	// Two dashboards from different namespaces should produce two
	// EmbedText calls (one per dashboard) and two Upsert calls.
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns-a", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns-b", "dash-2", 200, minimalDashboard("dash-2", "Dash 2")))

	s.processQueue(context.Background())

	assert.Equal(t, 2, text.calls, "one EmbedText call per dashboard")
	require.Len(t, vec.upserts, 2, "one Upsert per dashboard")
	assert.Equal(t, int64(200), vec.latestRV)
}

func TestReconciler_MultiPanelDashboard_SingleEmbedCall(t *testing.T) {
	// All panels of one dashboard go through BatchEmbedder.Embed in
	// a single call (provider-side chunking handles panel count).
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "big", 100, multiPanelDashboard("big", "Big Dash", 12)))

	s.processQueue(context.Background())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	assert.Len(t, vec.upserts[0], 12, "12 panels = 12 vectors in the upsert")
}

func TestReconciler_DeleteEvent_CallsVectorDelete(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash-x", 50, nil))

	s.processQueue(context.Background())

	require.Len(t, vec.deletes, 1)
	assert.Equal(t, deleteCall{Namespace: "ns", Model: testModel, Resource: dashRes, UID: "dash-x"}, vec.deletes[0])
	assert.Equal(t, int64(50), vec.latestRV)
	assert.Equal(t, 0, text.calls, "delete does not call the embedder")
}

func TestReconciler_PerEventFailure_BlocksAdvanceAtFailureRV(t *testing.T) {
	// Three dashboards: two succeed at RVs 100 and 300, one fails at 200.
	// Cursor advances to 199 so the failure is retried next cycle and
	// the unrelated successes don't get rolled back.
	vec := newFakeVector()
	vec.upsertErrFn = func(vs []vector.Vector) error {
		for _, v := range vs {
			if v.UID == "boom" {
				return errBoom
			}
		}
		return nil
	}
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "ok-a", 100, minimalDashboard("ok-a", "OK A")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "boom", 200, minimalDashboard("boom", "Boom")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "ok-b", 300, minimalDashboard("ok-b", "OK B")))

	s.processQueue(context.Background())

	// ok-a and ok-b succeeded; boom failed and is re-queued.
	require.Len(t, vec.upserts, 2)
	assert.Equal(t, int64(199), vec.latestRV)

	// boom should be back in the queue.
	s.queueMu.Lock()
	defer s.queueMu.Unlock()
	_, hasBoom := s.queue[eventQueueKey(dashGroup, dashRes, "ns", "boom")]
	assert.True(t, hasBoom)
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
	s.processQueue(context.Background())

	require.Len(t, vec.delsubs, 1)
	assert.ElementsMatch(t, []string{"panel/2"}, vec.delsubs[0].Subresources)
	require.Len(t, vec.upserts, 1)
}

func TestReconciler_MonotonicCheckpoint(t *testing.T) {
	vec := newFakeVector()
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processQueue(context.Background())
	require.Len(t, vec.upserts, 1)
	require.Equal(t, int64(100), vec.latestRV)
	require.Equal(t, 1, text.calls)

	// Same dashboard at a higher RV: dedup keeps the new one.
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash-1", 200, minimalDashboard("dash-1", "Dash 1 v2")))
	s.processQueue(context.Background())
	require.Len(t, vec.upserts, 2)
	require.Equal(t, int64(200), vec.latestRV)
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
	s.processQueue(context.Background())

	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.deletes)
	assert.Equal(t, 0, text.calls)
	assert.Equal(t, int64(49), vec.latestRV, "checkpoint stops at (failed - 1)")
}

// ---------- Bootstrap ----------

func TestReconciler_Bootstrap_SkipsWhenCursorIsZero(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")),
	}
	vec := newFakeVector() // latestRV stays 0
	s, text := newReconciler(t, st, vec)

	s.startupReconcile(context.Background())
	s.processQueue(context.Background())

	assert.Empty(t, vec.upserts, "startupReconcile is a no-op when cursor is 0")
	assert.Equal(t, 0, text.calls)
}

func TestReconciler_Bootstrap_PullsCrossNamespaceEvents(t *testing.T) {
	// Cursor non-zero → startupReconcile walks every namespace in one pass via
	// cross-namespace ListModifiedSince, enqueues each event, processes
	// them per-dashboard.
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns-a", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns-b", "dash-2", 200, minimalDashboard("dash-2", "Dash 2")),
	}
	vec := newFakeVector()
	vec.latestRV = 50 // anything below the change RVs
	s, text := newReconciler(t, st, vec)

	s.startupReconcile(context.Background())
	s.processQueue(context.Background())

	require.Len(t, vec.upserts, 2)
	assert.Equal(t, 2, text.calls)
	assert.Equal(t, int64(200), vec.latestRV)
}

func TestReconciler_Bootstrap_FiltersBelowCursor(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "old", 100, minimalDashboard("old", "Old")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "new", 200, minimalDashboard("new", "New")),
	}
	vec := newFakeVector()
	vec.latestRV = 150
	s, _ := newReconciler(t, st, vec)

	s.startupReconcile(context.Background())
	s.processQueue(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new", vec.upserts[0][0].UID)
	assert.Equal(t, int64(200), vec.latestRV)
}

// ---------- Watch path ----------

func TestReconciler_WatchEvent_DrivesNextCycle(t *testing.T) {
	st := &fakeStorage{}
	vec := newFakeVector()
	s, text := newReconciler(t, st, vec)

	s.processQueue(context.Background())
	require.Empty(t, vec.upserts)
	require.Equal(t, 0, text.calls)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns-x", "dash-1", 100, minimalDashboard("dash-1", "Dash 1")))
	s.processQueue(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, 1, text.calls)
	assert.Equal(t, int64(100), vec.latestRV)
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

	dashKey := eventQueueKey(dashGroup, dashRes, "ns-y", "d1")
	folderKey := eventQueueKey("folder.grafana.app", "folders", "ns-x", "f1")
	require.Eventually(t, func() bool {
		s.queueMu.Lock()
		defer s.queueMu.Unlock()
		_, dashboardQueued := s.queue[dashKey]
		_, folderQueued := s.queue[folderKey]
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

	s.processQueue(context.Background())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	require.Len(t, vec.upserts[0], 1)
	assert.Equal(t, int64(200), vec.upserts[0][0].ResourceVersion)
	assert.Equal(t, int64(200), vec.latestRV)
}

func TestReconciler_EnqueueDedup_DeleteOverridesOlderUpsert(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "Title")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_DELETED, "ns", "dash", 200, nil))

	s.processQueue(context.Background())

	assert.Empty(t, vec.upserts, "older upsert overridden by newer delete")
	require.Len(t, vec.deletes, 1)
	assert.Equal(t, "dash", vec.deletes[0].UID)
	assert.Equal(t, int64(200), vec.latestRV)
}

func TestReconciler_CursorFiltersAlreadyProcessedEvents(t *testing.T) {
	vec := newFakeVector()
	vec.latestRV = 150
	s, text := newReconciler(t, &fakeStorage{}, vec)

	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "old", 100, minimalDashboard("old", "Old")))
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "new", 200, minimalDashboard("new", "New")))

	s.processQueue(context.Background())

	assert.Equal(t, 1, text.calls)
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new", vec.upserts[0][0].UID)
	assert.Equal(t, int64(200), vec.latestRV)
}

// ---------- Retry cap ----------

func TestReconciler_RetryCap_DropsEventAfterMaxAttempts(t *testing.T) {
	vec := newFakeVector()
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "boom", 100, minimalDashboard("boom", "Boom")))

	for i := 0; i < maxEventAttempts; i++ {
		s.processQueue(context.Background())
	}

	require.Equal(t, 0, s.queueLen(), "event dropped after max attempts")
	assert.Empty(t, vec.upserts)
	// First failure pinned the cursor at lowestFailedRv-1 (= 99). On
	// the give-up cycle the failure no longer pins it, but no successful
	// event has a higher RV, so the cursor stays at 99 until something
	// past it succeeds.
	assert.Equal(t, int64(99), vec.latestRV)

	// A subsequent healthy event proves the scanner is unblocked and
	// advances the cursor.
	vec.upsertErr = nil
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns-other", "ok", 200, minimalDashboard("ok", "OK")))
	s.processQueue(context.Background())
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, int64(200), vec.latestRV)
}

func TestReconciler_RetryCap_FreshHigherRVResetsBudget(t *testing.T) {
	vec := newFakeVector()
	s, _ := newReconciler(t, &fakeStorage{}, vec)

	failingEv := dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "v1"))
	failingEv.attempts = maxEventAttempts - 1
	s.enqueue(failingEv)

	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "dash", 200, minimalDashboard("dash", "v2")))

	s.processQueue(context.Background())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, int64(200), vec.upserts[0][0].ResourceVersion)
	assert.Equal(t, int64(200), vec.latestRV)
}

func TestReconciler_RetryCap_ReEnqueuePreservesAttempts(t *testing.T) {
	vec := newFakeVector()
	vec.upsertErr = errBoom
	s, _ := newReconciler(t, &fakeStorage{}, vec)
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "dash", 100, minimalDashboard("dash", "v1")))

	s.processQueue(context.Background())
	require.Equal(t, 1, s.queueLen())

	s.queueMu.Lock()
	queued := s.queue[eventQueueKey(dashGroup, dashRes, "ns", "dash")]
	s.queueMu.Unlock()
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

// TestReconciler_StartupReconcile_FlushesAtBatchSize verifies that
// startupReconcile drains the listing iterator in startupBatchSize-sized
// chunks (so memory stays bounded) but advances the cursor exactly once
// at the end. Advancing per batch would lose events on real SQL where
// the rows come back ORDER BY resource_version DESC: the first
// (highest-RV) batch would bump the cursor past every later, lower-RV
// batch, silently dropping them.
func TestReconciler_StartupReconcile_FlushesAtBatchSize(t *testing.T) {
	prev := startupBatchSize
	startupBatchSize = 3
	t.Cleanup(func() { startupBatchSize = prev })

	st := &fakeStorage{}
	// Emit in DESC order to mirror the real SQL backend.
	for i := 6; i >= 0; i-- {
		rv := int64(100 + i*10)
		name := fmt.Sprintf("dash-%d", i)
		st.changes = append(st.changes,
			dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = 50
	s, _ := newReconciler(t, st, vec)

	s.startupReconcile(context.Background())

	require.Len(t, vec.upserts, 7, "every event must be processed across batched flushes")
	assert.Equal(t, int64(160), vec.latestRV, "cursor advances to highest RV")
	assert.Equal(t, 0, s.queueLen(), "queue is empty after startup")
	assert.Equal(t, 1, vec.setLatestRVCalls, "cursor advances exactly once at end of startup")
}

// TestReconciler_StartupReconcile_DescOrderDoesNotDropEvents is the
// regression test for the bug where startupReconcile flushed each
// batch via processBatch (which advances the cursor) while the real
// SQL backend yields ORDER BY resource_version DESC. The first batch
// held the highest RVs, the cursor jumped past every subsequent
// (lower-RV) batch's events, and they were silently filtered out by
// the "ev.rv <= sinceRv" guard.
func TestReconciler_StartupReconcile_DescOrderDoesNotDropEvents(t *testing.T) {
	prev := startupBatchSize
	startupBatchSize = 2
	t.Cleanup(func() { startupBatchSize = prev })

	st := &fakeStorage{}
	// Strictly descending RV order, mirroring the real SQL backend.
	for i := 5; i >= 0; i-- {
		rv := int64(100 + i*10)
		name := fmt.Sprintf("dash-%d", i)
		st.changes = append(st.changes,
			dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = 50
	s, _ := newReconciler(t, st, vec)

	s.startupReconcile(context.Background())

	assert.Len(t, vec.upserts, 6, "every event embedded even though batches arrive in DESC order")
	assert.Equal(t, int64(150), vec.latestRV)
}

// TestReconciler_StartupReconcile_DoesNotProcessWatchEvents verifies
// that a watch event queued while bootstrap is iterating is left in the
// global queue and is NOT processed mid-batch. If it were, its higher
// RV would advance the cursor past iter events not yet yielded, which
// would then be filtered out and never embedded.
func TestReconciler_StartupReconcile_DoesNotProcessWatchEvents(t *testing.T) {
	prev := startupBatchSize
	startupBatchSize = 2
	t.Cleanup(func() { startupBatchSize = prev })

	st := &fakeStorage{}
	for i := 0; i < 4; i++ {
		rv := int64(100 + i*10)
		name := fmt.Sprintf("iter-%d", i)
		st.changes = append(st.changes,
			dashChange(resourcepb.WatchEvent_ADDED, "ns", name, rv, minimalDashboard(name, name)))
	}

	vec := newFakeVector()
	vec.latestRV = 50
	s, _ := newReconciler(t, st, vec)

	// Pre-seed the global queue with a watch event at a much higher RV
	// for an unrelated dashboard. If bootstrap incorrectly drained the
	// global queue, this RV (9999) would become the new cursor and the
	// remaining iter events would be filtered out.
	s.enqueue(dashEvent(resourcepb.WatchEvent_ADDED, "ns", "watch-only", 9999,
		minimalDashboard("watch-only", "Watch Only")))

	s.startupReconcile(context.Background())

	// All 4 iter events embedded, watch event still queued.
	require.Len(t, vec.upserts, 4, "all iter events processed during bootstrap")
	for _, batch := range vec.upserts {
		require.NotEmpty(t, batch)
		assert.NotEqual(t, "watch-only", batch[0].UID, "watch event must not be processed during bootstrap")
	}
	assert.Equal(t, int64(130), vec.latestRV, "cursor stays within iter range during bootstrap")
	assert.Equal(t, 1, s.queueLen(), "watch event remains in global queue for the next cycle")

	// A subsequent processQueue (Run's first cycle) drains the watch event.
	s.processQueue(context.Background())
	require.Len(t, vec.upserts, 5)
	assert.Equal(t, "watch-only", vec.upserts[4][0].UID)
	assert.Equal(t, int64(9999), vec.latestRV)
}

// TestReconciler_StartupReconcile_SkipsIterEventsSupersededByWatch
// verifies the iter-side dedup: when watch has already queued a newer
// event for a dashboard, the iter's older copy is dropped before
// processing rather than wasting an embed call.
func TestReconciler_StartupReconcile_SkipsIterEventsSupersededByWatch(t *testing.T) {
	st := &fakeStorage{}
	st.changes = []*resource.ModifiedResource{
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "shared", 100, minimalDashboard("shared", "v1")),
		dashChange(resourcepb.WatchEvent_ADDED, "ns", "other", 110, minimalDashboard("other", "Other")),
	}
	vec := newFakeVector()
	vec.latestRV = 50
	s, _ := newReconciler(t, st, vec)

	// Watch already saw a newer write for "shared".
	s.enqueue(dashEvent(resourcepb.WatchEvent_MODIFIED, "ns", "shared", 500,
		minimalDashboard("shared", "v2")))

	s.startupReconcile(context.Background())

	// "other" is processed by bootstrap; "shared" is skipped because
	// watch's @500 supersedes iter's @100.
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "other", vec.upserts[0][0].UID)
	assert.Equal(t, 1, s.queueLen(), "watch's shared@500 stays queued")
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

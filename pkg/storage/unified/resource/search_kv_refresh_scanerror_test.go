package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// scanReportingBuilder models a KV-sourced builder: its snapshot is whatever
// it could read, and it reports a failed scan through
// KVFieldSnapshotErrorReporter instead of pretending every value vanished.
type scanReportingBuilder struct {
	testDocumentBuilder
	snap    KVFieldSnapshot
	scanErr error
}

func (b *scanReportingBuilder) KVFieldSnapshot() (KVFieldSnapshot, bool) { return b.snap, true }
func (b *scanReportingBuilder) KVFieldSnapshotErr() error                { return b.scanErr }

var (
	_ KVFieldSnapshotter           = (*scanReportingBuilder)(nil)
	_ KVFieldSnapshotErrorReporter = (*scanReportingBuilder)(nil)
)

type scanReportingSupplier struct {
	gr      schema.GroupResource
	mu      sync.Mutex
	snap    KVFieldSnapshot
	scanErr error
}

func (s *scanReportingSupplier) set(snap KVFieldSnapshot, scanErr error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snap, s.scanErr = snap, scanErr
}

func (s *scanReportingSupplier) GetDocumentBuilders(_ *SearchFieldsRegistry) ([]DocumentBuilderInfo, error) {
	return []DocumentBuilderInfo{
		{GroupResource: schema.GroupResource{}, Builder: &testDocumentBuilder{}},
		{
			GroupResource: s.gr,
			Namespaced: func(_ context.Context, _ string, _ BlobSupport) (DocumentBuilder, error) {
				s.mu.Lock()
				defer s.mu.Unlock()
				return &scanReportingBuilder{snap: s.snap, scanErr: s.scanErr}, nil
			},
		},
	}, nil
}

// A transient KV scan error during the periodic freshness check is reported
// as a refresh error and never queues a rebuild of the whole namespace; the
// initial index build still succeeds without the KV values.
func TestUpdaterFnKVFieldsRefresh_ScanErrorIsReportedNotRebuilt(t *testing.T) {
	t.Parallel()

	key := NamespacedResource{Namespace: "default", Group: "playlist.grafana.app", Resource: "playlists"}
	const interval = time.Hour
	good := KVFieldSnapshot{"p1": {"views_total": int64(10)}, "p2": {"views_total": int64(3)}}

	setup := func(t *testing.T, snap KVFieldSnapshot, scanErr error) (*searchServer, *scanReportingSupplier, UpdateFn) {
		t.Helper()
		supplier := &scanReportingSupplier{gr: schema.GroupResource{Group: key.Group, Resource: key.Resource}}
		supplier.set(snap, scanErr)
		search := &mockSearchBackend{}
		server, err := newSearchServer(SearchOptions{
			Backend:                search,
			Resources:              supplier,
			KVStatsRefreshInterval: interval,
		}, &trashStorageBackend{}, nil, nil, nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)

		_, err = server.build(t.Context(), key, 1, "test", false, time.Time{})
		require.NoError(t, err, "the initial index build must succeed even when the KV scan failed")

		search.mu.Lock()
		updater := search.lastUpdater
		search.mu.Unlock()
		require.NotNil(t, updater)
		return server, supplier, updater
	}
	forceCheckDue := func(server *searchServer) {
		server.builders.kvCheckMu.Lock()
		server.builders.kvLastChecked[key] = time.Now().Add(-2 * interval)
		server.builders.kvCheckMu.Unlock()
	}
	refreshCount := func(server *searchServer, result string) float64 {
		return testutil.ToFloat64(server.indexMetrics.KVFieldsRefreshTotal.WithLabelValues(key.Group, key.Resource, result))
	}
	runUpdater := func(t *testing.T, updater UpdateFn, rv int64) {
		t.Helper()
		idx := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: CurrentIndexFeatures()}}
		_, _, err := updater(t.Context(), idx, rv)
		require.NoError(t, err)
	}

	t.Run("a scan error on the fresh check is an error, not a change", func(t *testing.T) {
		t.Parallel()
		server, supplier, updater := setup(t, good, nil)
		errorsBefore := refreshCount(server, "error")
		changedBefore := refreshCount(server, "changed")

		forceCheckDue(server)
		supplier.set(KVFieldSnapshot{}, errors.New("kv scan unavailable"))
		runUpdater(t, updater, 2)

		require.Equal(t, 0, server.rebuildQueue.Len(), "a failed scan must not queue a rebuild of every resource")
		require.Equal(t, float64(1), refreshCount(server, "error")-errorsBefore, `a failed scan must count as result="error"`)
		require.Equal(t, float64(0), refreshCount(server, "changed")-changedBefore)
	})

	t.Run("after the scan recovers, a real change is still detected", func(t *testing.T) {
		t.Parallel()
		server, supplier, updater := setup(t, good, nil)

		forceCheckDue(server)
		supplier.set(KVFieldSnapshot{}, errors.New("kv scan unavailable"))
		runUpdater(t, updater, 2)
		require.Equal(t, 0, server.rebuildQueue.Len())

		forceCheckDue(server)
		supplier.set(KVFieldSnapshot{"p1": {"views_total": int64(99)}, "p2": {"views_total": int64(3)}}, nil)
		runUpdater(t, updater, 3)
		require.Equal(t, 1, server.rebuildQueue.Len(), "a real change after recovery must queue one rebuild")
	})

	t.Run("an index first built after a failed scan picks up the values once the scan works", func(t *testing.T) {
		t.Parallel()
		server, supplier, updater := setup(t, KVFieldSnapshot{}, errors.New("kv scan unavailable"))

		forceCheckDue(server)
		supplier.set(good, nil)
		runUpdater(t, updater, 2)
		require.Equal(t, 1, server.rebuildQueue.Len(), "the first good scan after a degraded build must queue a rebuild")
	})
}

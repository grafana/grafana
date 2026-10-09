package server

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
)

type lifecycleCalls struct {
	mu     sync.Mutex
	values []string
}

func (c *lifecycleCalls) add(value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.values = append(c.values, value)
}
func (c *lifecycleCalls) snapshot() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.values...)
}

type testStorage struct {
	StorageServer
	calls   *lifecycleCalls
	events  resource.Broadcaster[*resource.WrittenEvent]
	stopErr error
}

func (s *testStorage) Init(context.Context) error                                { s.calls.add("storage init"); return nil }
func (s *testStorage) BeginShutdown(context.Context)                             { s.calls.add("drain writes") }
func (s *testStorage) Stop(context.Context) error                                { s.calls.add("storage stop"); return s.stopErr }
func (s *testStorage) WriteEvents() resource.Broadcaster[*resource.WrittenEvent] { return s.events }

type testSearch struct {
	searchmodel.SearchServer
	calls   *lifecycleCalls
	initErr error
	stopErr error
}

func (s *testSearch) Init(context.Context) error { s.calls.add("search init"); return s.initErr }
func (s *testSearch) Stop(context.Context) error { s.calls.add("search stop"); return s.stopErr }

type testWorker struct {
	calls   *lifecycleCalls
	events  resource.Broadcaster[*resource.WrittenEvent]
	started chan struct{}
}

func (w *testWorker) UseBroadcaster(events resource.Broadcaster[*resource.WrittenEvent]) {
	w.events = events
	w.calls.add("attach events")
}
func (w *testWorker) Run(ctx context.Context) error {
	w.calls.add("worker run")
	close(w.started)
	<-ctx.Done()
	w.calls.add("worker stop")
	return ctx.Err()
}

func TestCompositionDoesNotImplementRPCServices(t *testing.T) {
	server := &Server{}
	_, storage := any(server).(resourcepb.ResourceStoreServer)
	_, search := any(server).(resourcepb.ResourceIndexServer)
	require.False(t, storage)
	require.False(t, search)
}

func TestComposedLifecycle(t *testing.T) {
	calls := &lifecycleCalls{}
	events := struct {
		resource.Broadcaster[*resource.WrittenEvent]
	}{}
	store := &testStorage{calls: calls, events: events}
	search := &testSearch{calls: calls}
	worker := &testWorker{calls: calls, started: make(chan struct{})}
	server := New(store, search, nil, worker)
	require.Empty(t, calls.snapshot())
	require.Same(t, store, server.StorageHandler())
	require.NoError(t, server.Init(t.Context()))
	require.NoError(t, server.Init(t.Context()))
	select {
	case <-worker.started:
	case <-t.Context().Done():
		t.Fatal("worker did not start")
	}
	require.Equal(t, events, worker.events)
	require.NoError(t, server.Stop(t.Context()))
	require.Equal(t, []string{"search init", "storage init", "attach events", "worker run", "drain writes", "worker stop", "search stop", "storage stop"}, calls.snapshot())
}

func TestSearchInitFailureDoesNotStartStorage(t *testing.T) {
	calls := &lifecycleCalls{}
	want := errors.New("search init failed")
	server := New(&testStorage{calls: calls}, &testSearch{calls: calls, initErr: want}, nil, nil)
	require.ErrorIs(t, server.Init(t.Context()), want)
	require.Equal(t, []string{"search init"}, calls.snapshot())
	require.NoError(t, server.Stop(t.Context()))
}

func TestSearchStopFailureStillStopsStorage(t *testing.T) {
	calls := &lifecycleCalls{}
	searchErr, storageErr := errors.New("search stop failed"), errors.New("storage stop failed")
	server := New(&testStorage{calls: calls, stopErr: storageErr}, &testSearch{calls: calls, stopErr: searchErr}, nil, nil)
	require.NoError(t, server.Init(t.Context()))
	err := server.Stop(t.Context())
	require.ErrorIs(t, err, searchErr)
	require.ErrorIs(t, err, storageErr)
	require.Equal(t, []string{"search init", "storage init", "drain writes", "search stop", "storage stop"}, calls.snapshot())
}

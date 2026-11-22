package controllerapp

import (
	"context"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

// fakeSource is a delta source the test drives by hand once the app runs it.
type fakeSource struct {
	mu       sync.Mutex
	handlers []cache.ResourceEventHandler
	synced   atomic.Bool
	running  chan struct{}
}

func newFakeSource() *fakeSource {
	return &fakeSource{running: make(chan struct{})}
}

func (s *fakeSource) AddEventHandler(h cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers = append(s.handlers, h)
	return &fakeRegistration{source: s}, nil
}

func (s *fakeSource) Run(stopCh <-chan struct{}) {
	close(s.running)
	<-stopCh
}

func (s *fakeSource) each(f func(cache.ResourceEventHandler)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, h := range s.handlers {
		f(h)
	}
}

// fakeRegistration answers only HasSynced, which is all the app reads.
type fakeRegistration struct {
	cache.ResourceEventHandlerRegistration
	source *fakeSource
}

func (r *fakeRegistration) HasSynced() bool { return r.source.synced.Load() }

type recordedEvent struct {
	action          string
	oldObj, obj     any
	isInInitialList bool
}

type recordingHandler struct {
	mu     sync.Mutex
	events []recordedEvent
}

func (h *recordingHandler) record(e recordedEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.events = append(h.events, e)
}

func (h *recordingHandler) recorded() []recordedEvent {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]recordedEvent(nil), h.events...)
}

func (h *recordingHandler) OnAdd(obj any, isInInitialList bool) {
	h.record(recordedEvent{action: "add", obj: obj, isInInitialList: isInInitialList})
}

func (h *recordingHandler) OnUpdate(oldObj, newObj any) {
	h.record(recordedEvent{action: "update", oldObj: oldObj, obj: newObj})
}

func (h *recordingHandler) OnDelete(obj any) {
	h.record(recordedEvent{action: "delete", obj: obj})
}

func testRepository(name, rv string) *apisprovisioning.Repository {
	return &apisprovisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: name, ResourceVersion: rv, Generation: 1}}
}

func TestAppDispatchesDeliveriesUnchanged(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		source := newFakeSource()
		source.synced.Store(true)
		handler := &recordingHandler{}
		app, err := New("test", logging.DefaultLogger, nil, WatchedKind{
			Info:    apisprovisioning.RepositoryResourceInfo,
			Source:  source,
			Handler: handler,
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		<-source.running

		initial := testRepository("initial", "1")
		live := testRepository("live", "2")
		updated := testRepository("live", "3")
		tombstone := cache.DeletedFinalStateUnknown{Key: "default/live", Obj: updated}
		source.each(func(h cache.ResourceEventHandler) {
			h.OnAdd(initial, true)
			h.OnAdd(live, false)
			h.OnUpdate(live, updated)
			h.OnDelete(tombstone)
		})
		synctest.Wait()

		assert.Equal(t, []recordedEvent{
			{action: "add", obj: initial, isInInitialList: true},
			{action: "add", obj: live, isInInitialList: false},
			{action: "update", oldObj: live, obj: updated},
			{action: "delete", obj: tombstone},
		}, handler.recorded())

		cancel()
		require.NoError(t, <-done)
	})
}

func TestAppRunsAPIServerInformer(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		clientset := fake.NewClientset(testRepository("existing", ""))
		source := informers.NewSharedInformerFactory(clientset, time.Hour).Provisioning().V0alpha1().Repositories().Informer()
		handler := &recordingHandler{}
		synced := make(chan struct{})
		app, err := New("test", logging.DefaultLogger, nil, WatchedKind{
			Info:    apisprovisioning.RepositoryResourceInfo,
			Source:  source,
			Handler: handler,
			OnSynced: func(context.Context) error {
				close(synced)
				return nil
			},
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		<-synced

		require.NoError(t, clientset.Tracker().Add(testRepository("created", "")))
		synctest.Wait()

		events := handler.recorded()
		require.Len(t, events, 2)
		assert.Equal(t, "existing", events[0].obj.(*apisprovisioning.Repository).Name)
		assert.True(t, events[0].isInInitialList)
		assert.Equal(t, "created", events[1].obj.(*apisprovisioning.Repository).Name)
		assert.False(t, events[1].isInInitialList)

		cancel()
		require.NoError(t, <-done)
	})
}

func TestAppOnSyncedWaitsForItsOwnKind(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		jobSource, repoSource := newFakeSource(), newFakeSource()
		var jobsSynced, reposSynced atomic.Bool
		app, err := New("test", logging.DefaultLogger, nil,
			WatchedKind{
				Info:    apisprovisioning.JobResourceInfo,
				Source:  jobSource,
				Handler: &recordingHandler{},
				OnSynced: func(context.Context) error {
					jobsSynced.Store(true)
					return nil
				},
			},
			WatchedKind{
				Info:    apisprovisioning.RepositoryResourceInfo,
				Source:  repoSource,
				Handler: &recordingHandler{},
				OnSynced: func(context.Context) error {
					reposSynced.Store(true)
					return nil
				},
			},
		)
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		<-jobSource.running
		<-repoSource.running

		time.Sleep(time.Second)
		assert.False(t, jobsSynced.Load(), "job runnable started before its informer synced")
		assert.False(t, reposSynced.Load(), "repository runnable started before its informer synced")

		repoSource.synced.Store(true)
		time.Sleep(time.Second)
		assert.False(t, jobsSynced.Load(), "job runnable started on another kind's sync")
		assert.True(t, reposSynced.Load(), "repository runnable did not start once its informer synced")

		jobSource.synced.Store(true)
		time.Sleep(time.Second)
		assert.True(t, jobsSynced.Load(), "job runnable did not start once its informer synced")

		cancel()
		require.NoError(t, <-done)
	})
}

func TestAppMetricsAreNamespaced(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		reg := prometheus.NewRegistry()
		source := newFakeSource()
		app, err := New("test", logging.DefaultLogger, reg, WatchedKind{
			Info:    apisprovisioning.ConnectionResourceInfo,
			Source:  source,
			Handler: &recordingHandler{},
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		<-source.running
		source.each(func(h cache.ResourceEventHandler) { h.OnAdd(testRepository("observed", "1"), false) })
		synctest.Wait()

		families, err := reg.Gather()
		require.NoError(t, err)
		require.NotEmpty(t, families)
		for _, f := range families {
			assert.True(t, strings.HasPrefix(f.GetName(), metricsNamespace+"_"), "metric %q is not namespaced", f.GetName())
		}

		cancel()
		require.NoError(t, <-done)
	})
}

func TestAppStopsWaitingAfterShutdownTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		app, err := New("test", logging.DefaultLogger, nil)
		require.NoError(t, err)
		release := make(chan struct{})
		app.AddRunnable(RunnableFunc(func(context.Context) error {
			<-release
			return nil
		}))

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Minute, logging.DefaultLogger) }()
		cancel()

		start := time.Now()
		require.NoError(t, <-done)
		assert.Equal(t, time.Minute, time.Since(start))
		close(release)
	})
}

package controller

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/informers/informerstest"
)

// gatedSource is a delta source whose initial sync completes when the test
// closes synced.
type gatedSource struct {
	synced chan struct{}
}

func newGatedSource() *gatedSource {
	return &gatedSource{synced: make(chan struct{})}
}

func (s *gatedSource) AddEventHandler(cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	return s, nil
}

func (s *gatedSource) Run(stopCh <-chan struct{}) { <-stopCh }

func (s *gatedSource) HasSynced() bool {
	select {
	case <-s.synced:
		return true
	default:
		return false
	}
}

func (s *gatedSource) HasSyncedChecker() cache.DoneChecker { return s }
func (s *gatedSource) Name() string                        { return "gated-source" }
func (s *gatedSource) Done() <-chan struct{}               { return s.synced }

func testConnectionControllerDeps() ConnectionControllerDeps {
	reg := prometheus.NewRegistry()
	return ConnectionControllerDeps{
		InformerClients: informerstest.NewClients(),
		Client:          fake.NewClientset(),
		HealthMetrics:   NewHealthMetricsRecorder(reg),
		Registry:        reg,
		Tracer:          tracing.NewNoopTracerService(),
		ResyncInterval:  time.Minute,
		DrainTimeout:    time.Second,
	}
}

func newGatedConnectionControllerRunner(t *testing.T, source *gatedSource) *ConnectionControllerRunner {
	t.Helper()
	runner, err := newConnectionControllerRunner(source, nil, testConnectionControllerDeps())
	require.NoError(t, err)
	return runner
}

func TestConnectionControllerRunner_Run(t *testing.T) {
	t.Run("starts workers only after the initial sync and stops when the context is done", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			source := newGatedSource()
			runner := newGatedConnectionControllerRunner(t, source)
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			started := make(chan struct{})
			runErr := make(chan error, 1)
			go func() { runErr <- runner.Run(ctx, 1, func() { close(started) }) }()

			// Well past the sync poll period, with the source still unsynced.
			time.Sleep(time.Second)
			synctest.Wait()
			require.False(t, isClosed(started), "workers started before the initial sync")

			close(source.synced)
			time.Sleep(time.Second)
			synctest.Wait()
			require.True(t, isClosed(started), "workers did not start after the initial sync")

			cancel()
			require.NoError(t, <-runErr)
		})
	})

	t.Run("returns context.Canceled when stopped before the initial sync", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			runner := newGatedConnectionControllerRunner(t, newGatedSource())
			ctx, cancel := context.WithCancel(t.Context())
			cancel()

			err := runner.Run(ctx, 1, func() { t.Error("onStarted must not be called") })
			require.ErrorIs(t, err, context.Canceled)
		})
	})

	t.Run("returns the cancellation cause when a dependency fails before the initial sync", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			runner := newGatedConnectionControllerRunner(t, newGatedSource())
			ctx, cancel := context.WithCancelCause(t.Context())
			errSubscriber := errors.New("nats subscriber failed")
			cancel(errSubscriber)

			err := runner.Run(ctx, 1, func() { t.Error("onStarted must not be called") })
			require.ErrorIs(t, err, errSubscriber)
			require.NotErrorIs(t, err, context.Canceled, "a dependency failure must not read as a clean stop")
		})
	})
}

func TestProvideConnectionController(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		runner, err := ProvideConnectionController(testConnectionControllerDeps())
		require.NoError(t, err)
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		started := make(chan struct{})
		runErr := make(chan error, 1)
		go func() { runErr <- runner.Run(ctx, 1, func() { close(started) }) }()

		time.Sleep(time.Second)
		synctest.Wait()
		require.True(t, isClosed(started), "workers did not start after the informer synced")

		cancel()
		require.NoError(t, <-runErr)
	})
}

func isClosed(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

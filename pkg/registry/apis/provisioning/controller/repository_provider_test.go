package controller

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func testRepositoryControllerDeps(objects ...runtime.Object) RepositoryControllerDeps {
	reg := prometheus.NewRegistry()
	return RepositoryControllerDeps{
		ProvisioningClient: fake.NewClientset(objects...),
		HealthMetrics:      NewHealthMetricsRecorder(reg),
		Registry:           reg,
		Tracer:             tracing.NewNoopTracerService(),
		ParallelOperations: 1,
		ResyncInterval:     time.Minute,
		DrainTimeout:       time.Second,
	}
}

func TestProvideRepositoryController_EnqueuesExistingRepositoriesOnSync(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()

	runner, err := ProvideRepositoryController(testRepositoryControllerDeps(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "repo-a"},
	}))
	require.NoError(t, err)
	require.False(t, runner.registration.HasSynced(), "the source must not run until the runner starts it")

	go runner.source.Run(ctx.Done())

	require.True(t, cache.WaitForCacheSync(ctx.Done(), runner.registration.HasSynced), "source should sync once the initial list is delivered")
	require.Equal(t, 1, runner.controller.queue.Len())
	key, _ := runner.controller.queue.Get()
	require.Equal(t, "default/repo-a", key)
}

func TestRepositoryControllerRunner_Run(t *testing.T) {
	t.Run("starts workers after the initial sync and shuts down when the context is done", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			runner, err := ProvideRepositoryController(testRepositoryControllerDeps())
			require.NoError(t, err)
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			started, shutdown := make(chan struct{}), make(chan struct{})
			runErr := make(chan error, 1)
			go func() {
				runErr <- runner.Run(ctx, 1, func() { close(started) }, func() { close(shutdown) })
			}()

			time.Sleep(time.Second)
			synctest.Wait()
			require.True(t, isClosed(started), "workers did not start after the informer synced")
			require.False(t, isClosed(shutdown))

			cancel()
			require.NoError(t, <-runErr)
			require.True(t, isClosed(shutdown), "onShutdown must be called when the context is done")
		})
	})

	t.Run("returns context.Canceled when stopped before the initial sync", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			runner, err := ProvideRepositoryController(testRepositoryControllerDeps())
			require.NoError(t, err)
			ctx, cancel := context.WithCancel(t.Context())
			cancel()

			err = runner.Run(ctx, 1, func() { t.Error("onStarted must not be called") }, func() {})
			require.ErrorIs(t, err, context.Canceled)
		})
	})

	t.Run("returns the cancellation cause when a dependency fails before the initial sync", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			runner, err := ProvideRepositoryController(testRepositoryControllerDeps())
			require.NoError(t, err)
			ctx, cancel := context.WithCancelCause(t.Context())
			errSubscriber := errors.New("nats subscriber failed")
			cancel(errSubscriber)

			err = runner.Run(ctx, 1, func() { t.Error("onStarted must not be called") }, func() {})
			require.ErrorIs(t, err, errSubscriber)
			require.NotErrorIs(t, err, context.Canceled, "a dependency failure must not read as a clean stop")
		})
	})
}

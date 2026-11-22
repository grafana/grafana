package controller

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

func newTestConnectionControllerRunner(t *testing.T) *ConnectionControllerRunner {
	t.Helper()
	reg := prometheus.NewRegistry()
	runner, err := ProvideConnectionController(ConnectionControllerDeps{
		Client:           fake.NewClientset(),
		HealthMetrics:    NewHealthMetricsRecorder(reg),
		RelistMetrics:    informer.NewRelistProjectionMetrics(reg),
		FreshnessMetrics: informer.NewFreshnessMetrics(reg),
		Registry:         reg,
		Tracer:           tracing.NewNoopTracerService(),
		ResyncInterval:   time.Minute,
		DrainTimeout:     time.Second,
	})
	require.NoError(t, err)
	return runner
}

func TestConnectionControllerRunner_Run(t *testing.T) {
	t.Run("starts workers after the initial sync and stops when the context is done", func(t *testing.T) {
		runner := newTestConnectionControllerRunner(t)
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		started := make(chan struct{})
		runErr := make(chan error, 1)
		go func() { runErr <- runner.Run(ctx, 1, func() { close(started) }) }()

		select {
		case <-started:
		case err := <-runErr:
			t.Fatalf("Run returned before starting: %v", err)
		case <-time.After(10 * time.Second):
			t.Fatal("connection controller did not start")
		}

		cancel()
		select {
		case err := <-runErr:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			t.Fatal("connection controller did not stop")
		}
	})

	t.Run("reports the context error when cancelled before the initial sync", func(t *testing.T) {
		runner := newTestConnectionControllerRunner(t)
		ctx, cancel := context.WithCancel(t.Context())
		cancel()

		err := runner.Run(ctx, 1, func() { t.Error("onStarted must not be called") })
		require.ErrorIs(t, err, context.Canceled)
	})
}

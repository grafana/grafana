package jobqueue

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func TestNewWorkers_EachActionHasExactlyOneWorker(t *testing.T) {
	extra := &actionWorker{action: provisioning.JobActionPullRequest}

	deps := Dependencies{
		Tracer:             tracing.NewNoopTracerService(),
		PerformanceEnabled: func(context.Context) bool { return true },
		ExtraWorkers:       []jobs.Worker{extra},
	}
	workers := newWorkers(Config{MaxSyncWorkers: 1}, deps, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))

	actions := []provisioning.JobAction{
		provisioning.JobActionPull,
		provisioning.JobActionPush,
		provisioning.JobActionMigrate,
		provisioning.JobActionDelete,
		provisioning.JobActionMove,
		provisioning.JobActionFixFolderMetadata,
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
		provisioning.JobActionTest,
		provisioning.JobActionPullRequest,
	}
	for _, action := range actions {
		var supporting []jobs.Worker
		for _, w := range workers {
			if w.IsSupported(context.Background(), job(action)) {
				supporting = append(supporting, w)
			}
		}
		assert.Len(t, supporting, 1, "action %q", action)
	}
	assert.Same(t, extra, workers[len(workers)-1], "extra workers are appended after the built-in ones")
}

func TestNewWorkers_PerformanceDisabledSkipsTestJobs(t *testing.T) {
	deps := Dependencies{
		Tracer:             tracing.NewNoopTracerService(),
		PerformanceEnabled: func(context.Context) bool { return false },
	}
	workers := newWorkers(Config{MaxSyncWorkers: 1}, deps, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))

	for _, w := range workers {
		assert.False(t, w.IsSupported(context.Background(), job(provisioning.JobActionTest)), "%T", w)
	}
}

func TestProvideDriver(t *testing.T) {
	deps := Dependencies{
		Store:              jobs.NewMockStore(t),
		RepoGetter:         jobs.NewMockRepoGetter(t),
		HistoryWriter:      jobs.NewMockHistoryWriter(t),
		Tracer:             tracing.NewNoopTracerService(),
		Registry:           prometheus.NewPedanticRegistry(),
		PerformanceEnabled: func(context.Context) bool { return false },
	}

	t.Run("builds a driver", func(t *testing.T) {
		driver, err := ProvideDriver(Config{
			ConcurrentDrivers:    3,
			MaxJobTimeout:        time.Minute,
			JobInterval:          30 * time.Second,
			LeaseRenewalInterval: 20 * time.Second,
			MaxSyncWorkers:       1,
		}, deps)
		require.NoError(t, err)
		require.NotNil(t, driver)
	})

	t.Run("rejects an invalid config", func(t *testing.T) {
		deps.Registry = prometheus.NewPedanticRegistry()
		_, err := ProvideDriver(Config{ConcurrentDrivers: 0, MaxSyncWorkers: 1}, deps)
		require.ErrorContains(t, err, "numDrivers must be greater than 0")
	})
}

// actionWorker stands in for a caller-provided worker such as the pull request one.
type actionWorker struct {
	jobs.Worker
	action provisioning.JobAction
}

func (w *actionWorker) IsSupported(_ context.Context, job provisioning.Job) bool {
	return job.Spec.Action == w.action
}

func job(action provisioning.JobAction) provisioning.Job {
	return provisioning.Job{Spec: provisioning.JobSpec{Action: action}}
}

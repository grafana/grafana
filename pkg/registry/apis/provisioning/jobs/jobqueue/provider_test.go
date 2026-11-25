package jobqueue

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
)

func TestNewWorkers_EachActionHasExactlyOneWorker(t *testing.T) {
	deps := Dependencies{
		Tracer:             tracing.NewNoopTracerService(),
		Registry:           prometheus.NewPedanticRegistry(),
		PerformanceEnabled: func(context.Context) bool { return true },
		ScreenshotRenderer: pullrequest.NewNoOpRenderer(),
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
}

func TestNewWorkers_AppendsExtraWorkers(t *testing.T) {
	extra := &actionWorker{action: "custom"}
	deps := Dependencies{
		Tracer:             tracing.NewNoopTracerService(),
		Registry:           prometheus.NewPedanticRegistry(),
		PerformanceEnabled: func(context.Context) bool { return false },
		ScreenshotRenderer: pullrequest.NewNoOpRenderer(),
		ExtraWorkers:       []jobs.Worker{extra},
	}
	workers := newWorkers(Config{MaxSyncWorkers: 1}, deps, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))

	assert.Same(t, extra, workers[len(workers)-1])
}

func TestNewWorkers_PerformanceDisabledSkipsTestJobs(t *testing.T) {
	deps := Dependencies{
		Tracer:             tracing.NewNoopTracerService(),
		Registry:           prometheus.NewPedanticRegistry(),
		PerformanceEnabled: func(context.Context) bool { return false },
		ScreenshotRenderer: pullrequest.NewNoOpRenderer(),
	}
	workers := newWorkers(Config{MaxSyncWorkers: 1}, deps, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()))

	for _, w := range workers {
		assert.False(t, w.IsSupported(context.Background(), job(provisioning.JobActionTest)), "%T", w)
	}
}

func TestProvideJobQueue(t *testing.T) {
	cfg := Config{
		ConcurrentDrivers:    1,
		MaxJobTimeout:        time.Minute,
		JobInterval:          30 * time.Second,
		LeaseRenewalInterval: 20 * time.Second,
		MaxSyncWorkers:       1,
	}
	newDeps := func(t *testing.T, store jobs.Store, objects ...runtime.Object) Dependencies {
		return Dependencies{
			Client:             fake.NewClientset(objects...),
			Store:              store,
			RepoGetter:         jobs.NewMockRepoGetter(t),
			HistoryWriter:      jobs.NewMockHistoryWriter(t),
			Tracer:             tracing.NewNoopTracerService(),
			Registry:           prometheus.NewPedanticRegistry(),
			PerformanceEnabled: func(context.Context) bool { return false },
			ScreenshotRenderer: pullrequest.NewNoOpRenderer(),
		}
	}

	t.Run("feeds pending jobs from the informer to the driver", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			pending := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "pending"}}
			claimed := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns",
				Name:      "claimed",
				Labels:    map[string]string{jobs.LabelJobClaim: "123"},
			}}

			store := jobs.NewMockStore(t)
			// The job is gone by the time it is claimed, so the driver drops it.
			store.EXPECT().Claim(mock.Anything, "ns", "pending", mock.Anything).
				Return(nil, nil, apierrors.NewNotFound(provisioning.JobResourceInfo.GroupResource(), "pending")).Once()

			queue, err := ProvideJobQueue(cfg, newDeps(t, store, pending, claimed))
			require.NoError(t, err)

			ctx, cancel := context.WithCancel(context.Background())
			done := make(chan error, 1)
			go func() { done <- queue.Run(ctx) }()

			synctest.Wait()
			assert.True(t, queue.HasSynced())

			cancel()
			require.NoError(t, <-done)
		})
	})

	t.Run("rejects an invalid config", func(t *testing.T) {
		_, err := ProvideJobQueue(Config{ConcurrentDrivers: 0, MaxSyncWorkers: 1}, newDeps(t, jobs.NewMockStore(t)))
		require.ErrorContains(t, err, "numDrivers must be greater than 0")
	})
}

// actionWorker stands in for a caller-provided extra worker.
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

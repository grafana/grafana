package workers

import (
	"context"
	"github.com/grafana/grafana/apps/provisioning/pkg/util/featuretest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func newTestWorkers() []jobs.Worker {
	return New(Config{
		Tracer:         tracing.NewNoopTracerService(),
		Metrics:        jobs.RegisterJobMetrics(prometheus.NewRegistry()),
		MaxSyncWorkers: 1,
	})
}

func supporting(t *testing.T, workers []jobs.Worker, action provisioning.JobAction) int {
	t.Helper()
	job := provisioning.Job{Spec: provisioning.JobSpec{Action: action}}
	n := 0
	for _, w := range workers {
		if w.IsSupported(context.Background(), job) {
			n++
		}
	}
	return n
}

func setPerformanceFlag(t *testing.T, enabled bool) {
	t.Helper()
	featuretest.Set(t, map[string]bool{jobs.FlagProvisioningPerformance: enabled})
}

func TestNewHandlesEachBuiltInActionOnce(t *testing.T) {
	workers := newTestWorkers()

	for _, action := range []provisioning.JobAction{
		provisioning.JobActionPull,
		provisioning.JobActionPush,
		provisioning.JobActionMigrate,
		provisioning.JobActionDelete,
		provisioning.JobActionMove,
		provisioning.JobActionFixFolderMetadata,
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
	} {
		require.Equal(t, 1, supporting(t, workers, action), "workers supporting %q", action)
	}
	require.Zero(t, supporting(t, workers, provisioning.JobActionPullRequest), "the pull request worker is appended by each caller")
}

func TestNewGatesTestJobsOnPerformanceFlag(t *testing.T) {
	workers := newTestWorkers()

	setPerformanceFlag(t, false)
	require.Zero(t, supporting(t, workers, provisioning.JobActionTest))

	setPerformanceFlag(t, true)
	require.Equal(t, 1, supporting(t, workers, provisioning.JobActionTest))
}

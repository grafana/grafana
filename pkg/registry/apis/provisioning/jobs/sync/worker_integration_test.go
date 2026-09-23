package sync

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestIntegrationSyncWorker_EarlySetupFailure(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	repoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	repoResourcesFactory.On("Client", mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("boom"))

	readerWriter := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
		MockVersioned:  repository.NewMockVersioned(t),
	}
	repoConfig := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test-repo",
			Namespace:  "test-namespace",
			Generation: 3,
		},
		Status: provisioning.RepositoryStatus{
			Sync: provisioning.SyncStatus{
				LastRef: "existing-ref",
			},
		},
	}
	readerWriter.MockRepository.On("Config").Return(repoConfig)

	var patchCalls [][]map[string]interface{}
	patchFn := func(ctx context.Context, repo *provisioning.Repository, ops ...map[string]interface{}) error {
		patchCalls = append(patchCalls, ops)
		return nil
	}

	worker := NewSyncWorker(
		resources.NewMockClientFactory(t),
		repoResourcesFactory,
		patchFn,
		NewMockSyncer(t),
		jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()),
		tracing.NewNoopTracerService(),
		10,
		0,
	)

	progress := jobs.NewJobProgressRecorder(func(ctx context.Context, status provisioning.JobStatus) error {
		return nil
	}, nil, provisioning.JobActionPull)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		},
	}

	err := worker.Process(context.Background(), readerWriter, job, progress)
	require.EqualError(t, err, "create repository resources client: boom")

	require.Len(t, patchCalls, 2)
	require.Len(t, patchCalls[0], 3)

	final := patchCalls[1]
	require.Len(t, final, 2)

	require.Equal(t, "replace", final[0]["op"])
	require.Equal(t, "/status/sync", final[0]["path"])
	syncStatus, ok := final[0]["value"].(provisioning.SyncStatus)
	require.True(t, ok)
	require.Equal(t, provisioning.JobStateError, syncStatus.State)
	require.Equal(t, "test-job", syncStatus.JobID)
	require.Equal(t, "existing-ref", syncStatus.LastRef)
	require.Equal(t, []string{"create repository resources client: boom"}, syncStatus.Message)
	require.NotZero(t, syncStatus.Started)
	require.NotZero(t, syncStatus.Finished)

	require.Equal(t, "replace", final[1]["op"])
	require.Equal(t, "/status/conditions", final[1]["path"])
	conditions, ok := final[1]["value"].([]metav1.Condition)
	require.True(t, ok)
	require.Len(t, conditions, 1)
	require.Equal(t, provisioning.ConditionTypePullStatus, conditions[0].Type)
	require.Equal(t, metav1.ConditionFalse, conditions[0].Status)
	require.Equal(t, provisioning.ReasonFailure, conditions[0].Reason)
	require.Equal(t, int64(3), conditions[0].ObservedGeneration)
	require.False(t, conditions[0].LastTransitionTime.IsZero())
}

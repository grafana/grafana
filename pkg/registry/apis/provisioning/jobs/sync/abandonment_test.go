package sync

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// mockRepositoryPatcher is a mock for RepositoryPatchFn
type mockRepositoryPatcher struct {
	mock.Mock
}

func (m *mockRepositoryPatcher) Patch(ctx context.Context, repo *provisioning.Repository, operations ...map[string]interface{}) error {
	args := m.Called(ctx, repo, operations)
	return args.Error(0)
}

func TestSyncAbandonmentHandler_SupportsAction(t *testing.T) {
	patcher := &mockRepositoryPatcher{}
	handler := NewSyncAbandonmentHandler(patcher.Patch)

	tests := []struct {
		name     string
		action   provisioning.JobAction
		expected bool
	}{
		{
			name:     "supports pull action",
			action:   provisioning.JobActionPull,
			expected: true,
		},
		{
			name:     "supports migrate action",
			action:   provisioning.JobActionMigrate,
			expected: true,
		},
		{
			name:     "does not support push action",
			action:   provisioning.JobActionPush,
			expected: false,
		},
		{
			name:     "does not support delete action",
			action:   provisioning.JobActionDelete,
			expected: false,
		},
		{
			name:     "does not support move action",
			action:   provisioning.JobActionMove,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := handler.SupportsAction(tt.action)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSyncAbandonmentHandler_HandleAbandonment(t *testing.T) {
	ctx := context.Background()

	t.Run("patches repository with all fields when job has message and finished", func(t *testing.T) {
		patcher := &mockRepositoryPatcher{}
		handler := NewSyncAbandonmentHandler(patcher.Patch)

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:    provisioning.JobStateError,
				Message:  "Job failed due to lease expiry",
				Finished: 1234567890,
			},
		}

		expectedRepo := &provisioning.Repository{}
		expectedRepo.SetName("test-repo")
		expectedRepo.SetNamespace("default")

		expectedOps := []map[string]interface{}{
			{
				"op":    "replace",
				"path":  "/status/sync/state",
				"value": provisioning.JobStateError,
			},
			{
				"op":    "replace",
				"path":  "/status/sync/message",
				"value": []string{"Job failed due to lease expiry"},
			},
			{
				"op":    "replace",
				"path":  "/status/sync/finished",
				"value": int64(1234567890),
			},
		}

		patcher.On("Patch", ctx, mock.MatchedBy(func(r *provisioning.Repository) bool {
			return r.GetName() == "test-repo" && r.GetNamespace() == "default"
		}), expectedOps).Return(nil)

		err := handler.HandleAbandonment(ctx, job)
		require.NoError(t, err)
		patcher.AssertExpectations(t)
	})

	t.Run("patches repository without message when job message is empty", func(t *testing.T) {
		patcher := &mockRepositoryPatcher{}
		handler := NewSyncAbandonmentHandler(patcher.Patch)

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:    provisioning.JobStateError,
				Message:  "", // Empty message
				Finished: 1234567890,
			},
		}

		expectedOps := []map[string]interface{}{
			{
				"op":    "replace",
				"path":  "/status/sync/state",
				"value": provisioning.JobStateError,
			},
			{
				"op":    "replace",
				"path":  "/status/sync/finished",
				"value": int64(1234567890),
			},
		}

		patcher.On("Patch", ctx, mock.Anything, expectedOps).Return(nil)

		err := handler.HandleAbandonment(ctx, job)
		require.NoError(t, err)
		patcher.AssertExpectations(t)
	})

	t.Run("patches repository without finished when job finished is zero", func(t *testing.T) {
		patcher := &mockRepositoryPatcher{}
		handler := NewSyncAbandonmentHandler(patcher.Patch)

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:    provisioning.JobStateError,
				Message:  "Job failed",
				Finished: 0, // Zero finished
			},
		}

		expectedOps := []map[string]interface{}{
			{
				"op":    "replace",
				"path":  "/status/sync/state",
				"value": provisioning.JobStateError,
			},
			{
				"op":    "replace",
				"path":  "/status/sync/message",
				"value": []string{"Job failed"},
			},
		}

		patcher.On("Patch", ctx, mock.Anything, expectedOps).Return(nil)

		err := handler.HandleAbandonment(ctx, job)
		require.NoError(t, err)
		patcher.AssertExpectations(t)
	})

	t.Run("patches repository with only state when message and finished are empty", func(t *testing.T) {
		patcher := &mockRepositoryPatcher{}
		handler := NewSyncAbandonmentHandler(patcher.Patch)

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:    provisioning.JobStateError,
				Message:  "",
				Finished: 0,
			},
		}

		expectedOps := []map[string]interface{}{
			{
				"op":    "replace",
				"path":  "/status/sync/state",
				"value": provisioning.JobStateError,
			},
		}

		patcher.On("Patch", ctx, mock.Anything, expectedOps).Return(nil)

		err := handler.HandleAbandonment(ctx, job)
		require.NoError(t, err)
		patcher.AssertExpectations(t)
	})

	t.Run("returns error when patch fails", func(t *testing.T) {
		patcher := &mockRepositoryPatcher{}
		handler := NewSyncAbandonmentHandler(patcher.Patch)

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:   provisioning.JobStateError,
				Message: "Job failed",
			},
		}

		expectedErr := errors.New("patch failed")
		patcher.On("Patch", ctx, mock.Anything, mock.Anything).Return(expectedErr)

		err := handler.HandleAbandonment(ctx, job)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "update repository sync status")
		patcher.AssertExpectations(t)
	})

	t.Run("handles migrate action", func(t *testing.T) {
		patcher := &mockRepositoryPatcher{}
		handler := NewSyncAbandonmentHandler(patcher.Patch)

		job := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionMigrate,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:   provisioning.JobStateError,
				Message: "Migration failed",
			},
		}

		patcher.On("Patch", ctx, mock.Anything, mock.Anything).Return(nil)

		err := handler.HandleAbandonment(ctx, job)
		require.NoError(t, err)
		patcher.AssertExpectations(t)
	})
}


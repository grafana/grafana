package jobs

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestIsOrphanCleanupAction(t *testing.T) {
	tests := []struct {
		action   provisioning.JobAction
		expected bool
	}{
		{provisioning.JobActionReleaseResources, true},
		{provisioning.JobActionDeleteResources, true},
		{provisioning.JobActionPull, false},
		{provisioning.JobActionPush, false},
		{provisioning.JobActionDelete, false},
		{provisioning.JobActionMigrate, false},
		{provisioning.JobActionMove, false},
		{provisioning.JobActionPullRequest, false},
		{provisioning.JobActionFixFolderMetadata, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.action), func(t *testing.T) {
			assert.Equal(t, tt.expected, IsOrphanCleanupAction(tt.action))
		})
	}
}

func TestValidateRepoForCleanup(t *testing.T) {
	t.Run("nil repo — allowed", func(t *testing.T) {
		require.NoError(t, ValidateRepoForCleanup(nil))
	})

	t.Run("terminating repo — allowed", func(t *testing.T) {
		now := metav1.Now()
		mockRepo := &repository.MockRepository{}
		mockRepo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "dying-repo",
				DeletionTimestamp: &now,
			},
		})
		require.NoError(t, ValidateRepoForCleanup(mockRepo))
	})

	t.Run("healthy repo — rejected", func(t *testing.T) {
		mockRepo := &repository.MockRepository{}
		mockRepo.On("Config").Return(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "healthy-repo"},
		})
		err := ValidateRepoForCleanup(mockRepo)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "was recreated")
		assert.Contains(t, err.Error(), "healthy-repo")
	})
}

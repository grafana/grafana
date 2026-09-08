package usage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestRepositoryDeletionStatusFromRepository(t *testing.T) {
	deletion := metav1.NewTime(time.Now().Add(-2 * time.Hour))
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			DeletionTimestamp: &deletion,
			Finalizers:        []string{"remove-orphan-resources", "cleanup"},
		},
		Status: provisioning.RepositoryStatus{
			DeleteError: "remove finalizers: conflict",
		},
	}

	got := RepositoryDeletionStatusFromRepository(repo)

	assert.Equal(t, deletion.UnixMilli(), got.DeletionTimestamp)
	assert.InDelta(t, (2 * time.Hour).Seconds(), got.PendingSeconds, 5)
	assert.Equal(t, []string{"remove-orphan-resources", "cleanup"}, got.Finalizers)
	assert.Equal(t, "remove finalizers: conflict", got.DeleteError)

	values := got.LogValues()
	require.Equal(t, "hasDeleteError", values[8])
	assert.Equal(t, 1, values[9])
	require.Equal(t, "finalizers", values[6])
	assert.Equal(t, "remove-orphan-resources,cleanup", values[7])
}

func TestRepositoryDeletionStatusFromRepository_NotDeleting(t *testing.T) {
	repo := &provisioning.Repository{}

	got := RepositoryDeletionStatusFromRepository(repo)

	assert.Zero(t, got.DeletionTimestamp)
	assert.Zero(t, got.PendingSeconds)
	assert.Empty(t, got.Finalizers)
	assert.Empty(t, got.DeleteError)

	values := got.LogValues()
	require.Equal(t, "hasDeleteError", values[8])
	assert.Equal(t, 0, values[9])
}

package usage

import (
	"testing"

	"github.com/stretchr/testify/assert"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestRepositoryUsageStatusFromRepository(t *testing.T) {
	repo := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			Sync: provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeInstance},
		},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.HealthStatus{Healthy: true},
			Sync:   provisioning.SyncStatus{State: provisioning.JobStateSuccess, Finished: 1_600_000_000_000},
			Stats: []provisioning.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7},
				{Group: "folder.grafana.app", Resource: "folders", Count: 3},
			},
		},
	}

	got := RepositoryUsageStatusFromRepository(repo)

	assert.Equal(t, RepositoryUsageStatus{
		Type:                 "github",
		SyncEnabled:          true,
		SyncTarget:           "instance",
		Healthy:              true,
		SyncState:            string(provisioning.JobStateSuccess),
		LastSyncFinished:     1_600_000_000_000,
		ManagedResourceCount: 10,
		ManagedResources:     "dashboard.grafana.app/dashboards=7 folder.grafana.app/folders=3",
	}, got)
}

func TestRepositoryUsageStatusFromRepository_NoStats(t *testing.T) {
	repo := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.LocalRepositoryType},
	}

	got := RepositoryUsageStatusFromRepository(repo)

	assert.Equal(t, "local", got.Type)
	assert.Equal(t, int64(0), got.ManagedResourceCount)
	assert.Empty(t, got.ManagedResources)
}

func TestRepositoryUsageStatus_LogValues(t *testing.T) {
	s := RepositoryUsageStatus{
		SyncTarget:           "folder",
		SyncEnabled:          false,
		Healthy:              false,
		SyncState:            "error",
		LastSyncFinished:     42,
		ManagedResourceCount: 5,
		ManagedResources:     "dashboard.grafana.app/dashboards=5",
	}

	// LogValues is an even-length key/value list; repository identity is on the
	// reconcile logger, so it is deliberately absent here.
	assert.Equal(t, []any{
		"target", "folder",
		"syncEnabled", false,
		"healthy", false,
		"syncState", "error",
		"lastSyncFinished", int64(42),
		"managedResourceCount", int64(5),
		"managedResources", "dashboard.grafana.app/dashboards=5",
	}, s.LogValues())
}

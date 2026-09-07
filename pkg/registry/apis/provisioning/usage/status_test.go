package usage

import (
	"testing"

	"github.com/stretchr/testify/assert"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestRepositoryUsageStatusFromRepository(t *testing.T) {
	stats := []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7},
		{Group: "folder.grafana.app", Resource: "folders", Count: 3},
	}
	repo := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			Sync: provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeInstance},
		},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.HealthStatus{Healthy: true},
			Sync:   provisioning.SyncStatus{State: provisioning.JobStateSuccess, Finished: 1_600_000_000_000},
			Stats:  stats,
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
		ManagedResources:     stats,
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
	assert.Empty(t, got.ManagedResourceLogValues())
}

func TestRepositoryUsageStatus_LogValues(t *testing.T) {
	s := RepositoryUsageStatus{
		SyncTarget:           "folder",
		SyncEnabled:          false,
		Healthy:              false,
		SyncState:            "error",
		LastSyncFinished:     42,
		ManagedResourceCount: 5,
	}

	// Booleans render as 1/0 so they can be unwrapped in Loki; repository identity
	// (incl. repositoryType) is on the reconcile logger, so it is absent here.
	assert.Equal(t, []any{
		"target", "folder",
		"syncEnabled", 0,
		"healthy", 0,
		"syncState", "error",
		"lastSyncFinished", int64(42),
		"managedResourceCount", int64(5),
	}, s.LogValues())
}

func TestRepositoryUsageStatus_ManagedResourceLogValues(t *testing.T) {
	s := RepositoryUsageStatus{
		ManagedResources: []provisioning.ResourceCount{
			{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7},
			{Group: "folder.grafana.app", Resource: "folders", Count: 3},
		},
	}

	// One unwrap-friendly line per kind: group/resource are values to group by,
	// count is the unwrappable metric.
	assert.Equal(t, [][]any{
		{"group", "dashboard.grafana.app", "resource", "dashboards", "count", int64(7)},
		{"group", "folder.grafana.app", "resource", "folders", "count", int64(3)},
	}, s.ManagedResourceLogValues())
}

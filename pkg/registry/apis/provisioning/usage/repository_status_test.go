package usage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestRepositoryUsageStatusFromRepository(t *testing.T) {
	stats := []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7},
		{Group: "folder.grafana.app", Resource: "folders", Count: 3},
	}
	created := metav1.NewTime(time.UnixMilli(1_500_000_000_000).UTC())
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			CreationTimestamp: created,
			Annotations:       map[string]string{utils.AnnoKeyUpdatedTimestamp: "2021-01-01T00:00:00Z"},
		},
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.GitHubRepositoryType,
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			Sync:      provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeInstance},
		},
		Secure: provisioning.SecureValues{Token: common.InlineSecureValue{Name: "repo-token"}},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.HealthStatus{Healthy: true},
			Sync:   provisioning.SyncStatus{State: provisioning.JobStateSuccess, Finished: 1_600_000_000_000},
			Stats:  stats,
			Conditions: []metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionTrue, Reason: provisioning.ReasonAvailable},
			},
		},
	}

	got := RepositoryUsageStatusFromRepository(repo)

	assert.Equal(t, RepositoryUsageStatus{
		Type:                 "github",
		CreatedAt:            1_500_000_000_000,
		UpdatedAt:            time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(),
		AuthMethod:           "token",
		ReadOnly:             false,
		SyncEnabled:          true,
		SyncTarget:           "instance",
		Healthy:              true,
		ReadyReason:          provisioning.ReasonAvailable,
		SyncState:            string(provisioning.JobStateSuccess),
		LastSyncFinishedAt:   1_600_000_000_000,
		ManagedResourceCount: 10,
		ManagedResources:     stats,
	}, got)
}

func TestRepositoryAuthMethod(t *testing.T) {
	tests := []struct {
		name string
		repo *provisioning.Repository
		want string
	}{
		{
			name: "local is none",
			repo: &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.LocalRepositoryType}},
			want: "none",
		},
		{
			name: "connection-backed",
			repo: &provisioning.Repository{Spec: provisioning.RepositorySpec{
				Type:       provisioning.GitHubRepositoryType,
				Connection: &provisioning.ConnectionInfo{Name: "my-conn"},
			}},
			want: "connection",
		},
		{
			name: "direct token",
			repo: &provisioning.Repository{
				Spec:   provisioning.RepositorySpec{Type: provisioning.GitRepositoryType},
				Secure: provisioning.SecureValues{Token: common.InlineSecureValue{Name: "repo-token"}},
			},
			want: "token",
		},
		{
			name: "anonymous public repo",
			repo: &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType}},
			want: "anonymous",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, RepositoryUsageStatusFromRepository(tt.repo).AuthMethod)
		})
	}
}

func TestRepositoryUsageStatus_ReadOnly(t *testing.T) {
	readonly := RepositoryUsageStatusFromRepository(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType},
	})
	assert.True(t, readonly.ReadOnly)

	writable := RepositoryUsageStatusFromRepository(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType, Workflows: []provisioning.Workflow{provisioning.BranchWorkflow}},
	})
	assert.False(t, writable.ReadOnly)
}

func TestRepositoryUsageStatusFromRepository_AuthFailure(t *testing.T) {
	repo := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.HealthStatus{Healthy: false, Error: provisioning.HealthFailureHealth},
			Conditions: []metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionFalse, Reason: provisioning.ReasonAuthenticationFailed},
			},
		},
	}

	got := RepositoryUsageStatusFromRepository(repo)

	assert.False(t, got.Healthy)
	assert.Equal(t, provisioning.ReasonAuthenticationFailed, got.ReadyReason)
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
	// No Ready condition and no updated annotation yet.
	assert.Empty(t, got.ReadyReason)
	assert.Equal(t, int64(0), got.UpdatedAt)
}

func TestRepositoryUsageStatus_LogValues(t *testing.T) {
	s := RepositoryUsageStatus{
		CreatedAt:            1_500_000_000_000,
		UpdatedAt:            1_550_000_000_000,
		AuthMethod:           "connection",
		ReadOnly:             true,
		SyncTarget:           "folder",
		SyncEnabled:          false,
		Healthy:              false,
		ReadyReason:          provisioning.ReasonAuthenticationFailed,
		SyncState:            "error",
		LastSyncFinishedAt:   42,
		ManagedResourceCount: 5,
	}

	// Booleans render as 1/0 so they can be unwrapped in Loki; repository identity
	// (incl. repositoryType) is on the reconcile logger, so it is absent here.
	assert.Equal(t, []any{
		"createdAt", int64(1_500_000_000_000),
		"updatedAt", int64(1_550_000_000_000),
		"authMethod", "connection",
		"readOnly", 1,
		"target", "folder",
		"syncEnabled", 0,
		"healthy", 0,
		"readyReason", provisioning.ReasonAuthenticationFailed,
		"syncState", "error",
		"lastSyncFinishedAt", int64(42),
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

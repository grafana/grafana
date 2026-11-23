package usage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestRepositoryUsageStatusFromRepository(t *testing.T) {
	stats := []provisioning.RepositoryResourceCount{
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
			Type:      provisioning.RepositorySpecTypeGithub,
			Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsWrite},
			Sync:      provisioning.RepositorySyncOptions{Enabled: true, Target: provisioning.RepositorySyncOptionsTargetInstance},
		},
		Secure: resource.InlineSecureValues{provisioning.RepositorySecureToken: resource.InlineSecureValue{Name: "repo-token"}},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.RepositoryHealthStatus{Healthy: true},
			Sync:   provisioning.RepositorySyncStatus{State: provisioning.RepositoryJobStateSuccess, Finished: new(int64(1_600_000_000_000))},
			Stats:  stats,
			Conditions: provisioning.ConditionsFromMeta[provisioning.RepositoryCondition]([]metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionTrue, Reason: provisioning.ReasonAvailable},
			}),
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
			repo: &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeLocal}},
			want: "none",
		},
		{
			name: "connection-backed",
			repo: &provisioning.Repository{Spec: provisioning.RepositorySpec{
				Type:       provisioning.RepositorySpecTypeGithub,
				Connection: &provisioning.RepositoryConnectionInfo{Name: "my-conn"},
			}},
			want: "connection",
		},
		{
			name: "direct token",
			repo: &provisioning.Repository{
				Spec:   provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeGit},
				Secure: resource.InlineSecureValues{provisioning.RepositorySecureToken: resource.InlineSecureValue{Name: "repo-token"}},
			},
			want: "token",
		},
		{
			name: "anonymous public repo",
			repo: &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeGit}},
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
		Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeGit},
	})
	assert.True(t, readonly.ReadOnly)

	writable := RepositoryUsageStatusFromRepository(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeGit, Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsBranch}},
	})
	assert.False(t, writable.ReadOnly)
}

func TestRepositoryUsageStatusFromRepository_AuthFailure(t *testing.T) {
	repo := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeGithub},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.RepositoryHealthStatus{Healthy: false, Error: new(provisioning.HealthFailureHealth)},
			Conditions: provisioning.ConditionsFromMeta[provisioning.RepositoryCondition]([]metav1.Condition{
				{Type: provisioning.ConditionTypeReady, Status: metav1.ConditionFalse, Reason: provisioning.ReasonAuthenticationFailed},
			}),
		},
	}

	got := RepositoryUsageStatusFromRepository(repo)

	assert.False(t, got.Healthy)
	assert.Equal(t, provisioning.ReasonAuthenticationFailed, got.ReadyReason)
}

func TestRepositoryUsageStatusFromRepository_NoStats(t *testing.T) {
	repo := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.RepositorySpecTypeLocal},
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
		TokenLastUpdatedAt:   1_600_000_000_000,
		TokenExpiresAt:       1_600_003_600_000,
		WebhookLastRotatedAt: 1_599_000_000_000,
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
		"tokenLastUpdatedAt", int64(1_600_000_000_000),
		"tokenExpiresAt", int64(1_600_003_600_000),
		"webhookLastRotatedAt", int64(1_599_000_000_000),
	}, s.LogValues())
}

func TestRepositoryUsageStatus_ManagedResourceLogValues(t *testing.T) {
	s := RepositoryUsageStatus{
		ManagedResources: []provisioning.RepositoryResourceCount{
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

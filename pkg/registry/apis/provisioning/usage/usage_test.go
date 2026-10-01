package usage

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// managedKind is the manager kind reported by CountManagedObjects (e.g. "repo"),
// which is what the collector keys stats.managed_by.<kind>.count on.
const managedKind = "repo"

func managedCount(kind string, count int64) *resourcepb.CountManagedObjectsResponse {
	return &resourcepb.CountManagedObjectsResponse{
		Items: []*resourcepb.CountManagedObjectsResponse_ResourceCount{
			{Kind: kind, Count: count},
		},
	}
}

// no unified storage -> nothing to count, no error.
func TestMetricCollector_NoUnifiedStorage(t *testing.T) {
	fn := MetricCollector(tracing.NewNoopTracerService(), nil, nil, nil, nil)

	m, err := fn(context.Background())
	require.NoError(t, err)
	require.Empty(t, m)
}

// nil namespace lister falls back to the "default" namespace (single-tenant behaviour).
func TestMetricCollector_FallbackDefaultNamespace(t *testing.T) {
	unified := resource.NewMockResourceClient(t)
	unified.EXPECT().
		CountManagedObjects(mock.Anything, mock.MatchedBy(func(req *resourcepb.CountManagedObjectsRequest) bool {
			return req.Namespace == "default"
		})).
		Return(managedCount(managedKind, 2), nil).
		Once()

	repoLister := func(ctx context.Context) ([]provisioning.Repository, error) {
		// The collector must scope the context to the namespace it is counting.
		require.Equal(t, "default", request.NamespaceValue(ctx))
		return []provisioning.Repository{
			{Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType}},
		}, nil
	}

	fn := MetricCollector(tracing.NewNoopTracerService(), nil, repoLister, nil, unified)

	m, err := fn(context.Background())
	require.NoError(t, err)
	require.Equal(t, 2, m["stats.managed_by."+managedKind+".count"])
	require.Equal(t, 1, m["stats.repository."+string(provisioning.GitHubRepositoryType)+".count"])
}

// counts from every namespace are summed into the same stat keys.
func TestMetricCollector_AggregatesAcrossNamespaces(t *testing.T) {
	unified := resource.NewMockResourceClient(t)
	unified.EXPECT().
		CountManagedObjects(mock.Anything, mock.MatchedBy(func(req *resourcepb.CountManagedObjectsRequest) bool {
			return req.Namespace == "default"
		})).
		Return(managedCount(managedKind, 3), nil).
		Once()
	unified.EXPECT().
		CountManagedObjects(mock.Anything, mock.MatchedBy(func(req *resourcepb.CountManagedObjectsRequest) bool {
			return req.Namespace == "org-2"
		})).
		Return(managedCount(managedKind, 2), nil).
		Once()

	repoLister := func(ctx context.Context) ([]provisioning.Repository, error) {
		github := provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType}}
		switch request.NamespaceValue(ctx) {
		case "default":
			return []provisioning.Repository{github}, nil
		case "org-2":
			return []provisioning.Repository{github, github}, nil
		default:
			return nil, nil
		}
	}
	namespaces := func(ctx context.Context) ([]string, error) {
		return []string{"default", "org-2"}, nil
	}

	fn := MetricCollector(tracing.NewNoopTracerService(), namespaces, repoLister, nil, unified)

	m, err := fn(context.Background())
	require.NoError(t, err)
	require.Equal(t, 5, m["stats.managed_by."+managedKind+".count"])                               // 3 + 2
	require.Equal(t, 3, m["stats.repository."+string(provisioning.GitHubRepositoryType)+".count"]) // 1 + 2
}

// fleet-wide dimensions are aggregated from repository spec/status across namespaces.
func TestMetricCollector_RepositoryDimensions(t *testing.T) {
	unified := resource.NewMockResourceClient(t)
	unified.EXPECT().
		CountManagedObjects(mock.Anything, mock.Anything).
		Return(managedCount(managedKind, 0), nil).
		Once()

	repoLister := func(ctx context.Context) ([]provisioning.Repository, error) {
		return []provisioning.Repository{
			{
				// Healthy, sync enabled to instance, editable via write + branch,
				// last sync succeeded, webhook disabled, auth delegated to a connection.
				// The duplicate write workflow must still count as a single write
				// capability (validator accepts duplicates).
				Spec: provisioning.RepositorySpec{
					Type:       provisioning.GitHubRepositoryType,
					Workflows:  []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.WriteWorkflow, provisioning.BranchWorkflow},
					Sync:       provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeInstance},
					Webhook:    &provisioning.WebhookConfig{Disabled: true},
					Connection: &provisioning.ConnectionInfo{Name: "my-conn"},
				},
				Status: provisioning.RepositoryStatus{
					Health: provisioning.HealthStatus{Healthy: true},
					Sync:   provisioning.SyncStatus{State: provisioning.JobStateSuccess},
					Conditions: []metav1.Condition{
						{Type: provisioning.ConditionTypeReady, Reason: provisioning.ReasonAvailable},
					},
				},
			},
			{
				// Unhealthy, read-only (no workflows), sync disabled to a folder,
				// last sync errored, local repository (auth method "none").
				Spec: provisioning.RepositorySpec{
					Type:  provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{Path: "/tmp/repo"},
					Sync:  provisioning.SyncOptions{Enabled: false, Target: provisioning.SyncTargetTypeFolder},
				},
				Status: provisioning.RepositoryStatus{
					Health: provisioning.HealthStatus{Healthy: false},
					Sync:   provisioning.SyncStatus{State: provisioning.JobStateError},
					Conditions: []metav1.Condition{
						{Type: provisioning.ConditionTypeReady, Reason: provisioning.ReasonInvalidSpec},
					},
				},
			},
		}, nil
	}

	fn := MetricCollector(tracing.NewNoopTracerService(), nil, repoLister, nil, unified)

	m, err := fn(context.Background())
	require.NoError(t, err)

	require.Equal(t, 2, m["stats.repository.count"])
	require.Equal(t, 1, m["stats.repository.healthy.count"])
	require.Equal(t, 1, m["stats.repository.unhealthy.count"])
	require.Equal(t, 1, m["stats.repository.sync_enabled.count"])
	require.Equal(t, 1, m["stats.repository.read_only.count"])
	require.Equal(t, 1, m["stats.repository.webhook_disabled.count"])
	require.Equal(t, 1, m["stats.repository.workflow.write.count"])
	require.Equal(t, 1, m["stats.repository.workflow.branch.count"])

	require.Equal(t, 1, m["stats.repository.sync_target."+string(provisioning.SyncTargetTypeInstance)+".count"])
	require.Equal(t, 1, m["stats.repository.sync_target."+string(provisioning.SyncTargetTypeFolder)+".count"])
	require.Equal(t, 1, m["stats.repository.sync_state."+string(provisioning.JobStateSuccess)+".count"])
	require.Equal(t, 1, m["stats.repository.sync_state."+string(provisioning.JobStateError)+".count"])

	require.Equal(t, 1, m["stats.repository.auth_method.connection.count"])
	require.Equal(t, 1, m["stats.repository.auth_method.none.count"])

	require.Equal(t, 1, m["stats.repository.ready_reason."+strings.ToLower(provisioning.ReasonAvailable)+".count"])
	require.Equal(t, 1, m["stats.repository.ready_reason."+strings.ToLower(provisioning.ReasonInvalidSpec)+".count"])

	// The duplicate write workflow on the first repo still counts once.
	require.Equal(t, 1, m["stats.repository.workflow.write.count"])
	require.Equal(t, 1, m["stats.repository.workflow.branch.count"])

	// No connection lister was wired, so no connection keys are emitted at all --
	// zero-valued keys would conflate "not wired" with "empty fleet".
	_, ok := m["stats.connection.count"]
	require.False(t, ok, "connection stats must be absent without a lister")
}

// connection stats are aggregated by type, health, and webhook state.
func TestMetricCollector_ConnectionStats(t *testing.T) {
	unified := resource.NewMockResourceClient(t)
	unified.EXPECT().
		CountManagedObjects(mock.Anything, mock.Anything).
		Return(managedCount(managedKind, 0), nil).
		Once()

	repoLister := func(ctx context.Context) ([]provisioning.Repository, error) {
		return nil, nil
	}
	connLister := func(ctx context.Context) ([]provisioning.Connection, error) {
		return []provisioning.Connection{
			{
				Spec:   provisioning.ConnectionSpec{Type: provisioning.GithubConnectionType},
				Status: provisioning.ConnectionStatus{Health: provisioning.HealthStatus{Healthy: true}},
			},
			{
				Spec: provisioning.ConnectionSpec{
					Type:    provisioning.GithubOAuthConnectionType,
					Webhook: &provisioning.ConnectionWebhookConfig{Disabled: true},
				},
				Status: provisioning.ConnectionStatus{
					Health: provisioning.HealthStatus{Healthy: false},
					Conditions: []metav1.Condition{
						{Type: provisioning.ConditionTypeReady, Reason: provisioning.ReasonAuthenticationFailed},
					},
				},
			},
		}, nil
	}

	fn := MetricCollector(tracing.NewNoopTracerService(), nil, repoLister, connLister, unified)

	m, err := fn(context.Background())
	require.NoError(t, err)

	require.Equal(t, 2, m["stats.connection.count"])
	require.Equal(t, 1, m["stats.connection.healthy.count"])
	require.Equal(t, 1, m["stats.connection.unhealthy.count"])
	require.Equal(t, 1, m["stats.connection.webhook_disabled.count"])
	require.Equal(t, 1, m["stats.connection."+string(provisioning.GithubConnectionType)+".count"])
	require.Equal(t, 1, m["stats.connection."+string(provisioning.GithubOAuthConnectionType)+".count"])
	require.Equal(t, 1, m["stats.connection.ready_reason."+strings.ToLower(provisioning.ReasonAuthenticationFailed)+".count"])
}

// an error from any namespace fails the whole collection (fail-fast).
func TestMetricCollector_ErrorFailFast(t *testing.T) {
	unified := resource.NewMockResourceClient(t)
	unified.EXPECT().
		CountManagedObjects(mock.Anything, mock.Anything).
		Return(nil, errors.New("boom")).
		Once()
	namespaces := func(ctx context.Context) ([]string, error) {
		return []string{"default"}, nil
	}

	fn := MetricCollector(tracing.NewNoopTracerService(), namespaces, nil, nil, unified)

	_, err := fn(context.Background())
	require.Error(t, err)
}

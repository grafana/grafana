package usage

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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
	fn := MetricCollector(tracing.NewNoopTracerService(), nil, nil, nil)

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

	fn := MetricCollector(tracing.NewNoopTracerService(), nil, repoLister, unified)

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

	fn := MetricCollector(tracing.NewNoopTracerService(), namespaces, repoLister, unified)

	m, err := fn(context.Background())
	require.NoError(t, err)
	require.Equal(t, 5, m["stats.managed_by."+managedKind+".count"])                               // 3 + 2
	require.Equal(t, 3, m["stats.repository."+string(provisioning.GitHubRepositoryType)+".count"]) // 1 + 2
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

	fn := MetricCollector(tracing.NewNoopTracerService(), namespaces, nil, unified)

	_, err := fn(context.Background())
	require.Error(t, err)
}

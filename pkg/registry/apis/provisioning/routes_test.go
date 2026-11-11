package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestHandleStats_ScopedToOneRepository(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	store.EXPECT().CountManagedObjects(mock.Anything, &resourcepb.CountManagedObjectsRequest{
		Namespace: "default",
		Kind:      string(utils.ManagerKindRepo),
		Id:        "repo",
	}).Return(&resourcepb.CountManagedObjectsResponse{
		Items: []*resourcepb.CountManagedObjectsResponse_ResourceCount{{
			Kind: string(utils.ManagerKindRepo), Id: "repo",
			Group: "dashboard.grafana.app", Resource: "dashboards", Count: 3,
		}},
	}, nil).Once()
	// GetStats is deliberately left unexpected: the mock fails the test if the namespace-wide
	// instance read is issued for a scoped request.

	stats := statsResponse(t, store, "/?repository=repo")
	require.Equal(t, []provisioning.ManagerStats{{
		Kind:     utils.ManagerKindRepo,
		Identity: "repo",
		Stats:    []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 3}},
	}}, stats.Managed)
	require.Empty(t, stats.Instance)
}

func TestHandleStats_WithoutARepositoryReadsTheWholeNamespace(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	store.EXPECT().CountManagedObjects(mock.Anything, &resourcepb.CountManagedObjectsRequest{
		Namespace: "default",
	}).Return(&resourcepb.CountManagedObjectsResponse{}, nil).Once()
	store.EXPECT().GetStats(mock.Anything, &resourcepb.ResourceStatsRequest{
		Namespace: "default",
	}).Return(&resourcepb.ResourceStatsResponse{
		Stats: []*resourcepb.ResourceStatsResponse_Stats{{
			Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7,
		}},
	}, nil).Once()

	stats := statsResponse(t, store, "/")
	require.Empty(t, stats.Managed)
	require.Equal(t, []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7}}, stats.Instance)
}

func statsResponse(t *testing.T, store resources.ResourceStore, target string) provisioning.ResourceStats {
	t.Helper()
	b := &APIBuilder{resourceLister: resources.NewResourceLister(store, nil, nil)}
	ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{Namespace: "default"})

	w := httptest.NewRecorder()
	b.handleStats(w, httptest.NewRequest(http.MethodGet, target, nil).WithContext(ctx))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var stats provisioning.ResourceStats
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stats))
	return stats
}

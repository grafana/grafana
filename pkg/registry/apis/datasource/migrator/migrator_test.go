package migrator

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStorageGroupsForDatasources(t *testing.T) {
	const ns = "org-1"

	t.Run("maps discovered datasource identities to group resources", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().
			ListStoredResources(mock.Anything, mock.MatchedBy(func(req *resourcepb.ListStoredResourcesRequest) bool {
				// Discovery must be scoped to the namespace and datasources resource.
				return req.Namespace == ns && req.Resource == "datasources"
			})).
			Return(&resourcepb.ListStoredResourcesResponse{
				Items: []*resourcepb.ListStoredResourcesResponse_StoredResource{
					{Namespace: ns, Group: "prometheus.datasource.grafana.app", Resource: "datasources"},
					{Namespace: ns, Group: "loki.datasource.grafana.app", Resource: "datasources"},
				},
			}, nil)

		got, err := storageGroupsForDatasources(t.Context(), ns, client)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupResource{
			{Group: "prometheus.datasource.grafana.app", Resource: "datasources"},
			{Group: "loki.datasource.grafana.app", Resource: "datasources"},
		}, got)
	})

	t.Run("empty discovery yields no groups", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().
			ListStoredResources(mock.Anything, mock.Anything).
			Return(&resourcepb.ListStoredResourcesResponse{}, nil)

		got, err := storageGroupsForDatasources(t.Context(), ns, client)
		require.NoError(t, err)
		require.Empty(t, got)
	})

	t.Run("propagates discovery error", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().
			ListStoredResources(mock.Anything, mock.Anything).
			Return(nil, errors.New("boom"))

		_, err := storageGroupsForDatasources(t.Context(), ns, client)
		require.Error(t, err)
	})
}

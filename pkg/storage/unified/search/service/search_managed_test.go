package service

import (
	"net/http"
	"testing"

	resource "github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
	"github.com/stretchr/testify/require"
)

// newDiscoveryTestSearchServer builds a searchServer wired to the given storage and
// search backends, with the minimal options the constructor requires.
func newDiscoveryTestSearchServer(t *testing.T, storage resource.StorageBackend, search searchmodel.SearchBackend) *searchServer {
	t.Helper()
	opts := searchmodel.SearchOptions{
		Backend:      search,
		Resources:    &searchmodel.TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resource"}},
		InitMinCount: 1,
	}
	server, err := newSearchServer(opts, storage, nil, nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, server)
	return server
}

func TestListManagedObjectsUsesDiscovery(t *testing.T) {
	const ns = "ns"
	gr := resourcecontract.NamespacedResource{Namespace: ns, Group: "group", Resource: "dashboards"}

	storage := &mockStorageBackend{
		resourceStats: []resourcecontract.ResourceStats{{NamespacedResource: gr, Count: 5}},
	}
	search := &mockSearchBackend{
		cache: map[resourcecontract.NamespacedResource]searchmodel.ResourceIndex{
			gr: &MockResourceIndex{managedObjects: &resourcepb.ListManagedObjectsResponse{
				Items: []*resourcepb.ListManagedObjectsResponse_Item{{Path: "p1"}, {Path: "p2"}},
			}},
		},
	}
	server := newDiscoveryTestSearchServer(t, storage, search)

	rsp, err := server.ListManagedObjects(t.Context(), &resourcepb.ListManagedObjectsRequest{Namespace: ns})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.Len(t, rsp.Items, 2)

	require.Zero(t, storage.statsCalls.Load(), "GetResourceStats must not be called")
	require.Positive(t, storage.listStoredCalls.Load(), "discovery must be used")
}

func TestCountManagedObjectsUsesDiscovery(t *testing.T) {
	const ns = "ns"
	gr := resourcecontract.NamespacedResource{Namespace: ns, Group: "group", Resource: "dashboards"}

	storage := &mockStorageBackend{
		resourceStats: []resourcecontract.ResourceStats{{NamespacedResource: gr, Count: 5}},
	}
	search := &mockSearchBackend{
		cache: map[resourcecontract.NamespacedResource]searchmodel.ResourceIndex{
			gr: &MockResourceIndex{managedCounts: []*resourcepb.CountManagedObjectsResponse_ResourceCount{
				{Kind: "dashboard", Count: 4},
			}},
		},
	}
	server := newDiscoveryTestSearchServer(t, storage, search)

	rsp, err := server.CountManagedObjects(t.Context(), &resourcepb.CountManagedObjectsRequest{Namespace: ns})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.Len(t, rsp.Items, 1)
	require.Equal(t, int64(4), rsp.Items[0].Count)

	require.Zero(t, storage.statsCalls.Load(), "GetResourceStats must not be called")
	require.Positive(t, storage.listStoredCalls.Load(), "discovery must be used")
}

// Discovery requires a namespace, so these RPCs must reject an empty one before
// reaching the backend.
func TestManagedObjectsRequireNamespace(t *testing.T) {
	storage := &mockStorageBackend{}
	server := newDiscoveryTestSearchServer(t, storage, &mockSearchBackend{})

	t.Run("ListManagedObjects", func(t *testing.T) {
		rsp, err := server.ListManagedObjects(t.Context(), &resourcepb.ListManagedObjectsRequest{})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusBadRequest), rsp.Error.Code)
	})

	t.Run("CountManagedObjects", func(t *testing.T) {
		rsp, err := server.CountManagedObjects(t.Context(), &resourcepb.CountManagedObjectsRequest{})
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		require.Equal(t, int32(http.StatusBadRequest), rsp.Error.Code)
	})

	require.Zero(t, storage.listStoredCalls.Load(), "discovery must not run without a namespace")
}

package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type injectedIndexQueries struct {
	searchFn func(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
	statsFn  func(context.Context, *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error)
}

func (s injectedIndexQueries) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return s.searchFn(ctx, req)
}

func (s injectedIndexQueries) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	return s.statsFn(ctx, req)
}

func TestResourceServerInjectedIndexQueries(t *testing.T) {
	request := &resourcepb.ResourceStatsRequest{Namespace: "ns"}
	response := &resourcepb.ResourceStatsResponse{}
	server, err := NewUninitializedResourceServer(ResourceServerOptions{
		Backend: &mockStorageBackend{},
		IndexQueries: injectedIndexQueries{statsFn: func(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
			require.Equal(t, t.Context(), ctx)
			require.Same(t, request, req)
			return response, nil
		}},
	})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, server.Stop(t.Context())) })
	require.NoError(t, server.Init(t.Context()))
	actual, err := server.GetStats(t.Context(), request)
	require.NoError(t, err)
	require.Same(t, response, actual)
}

func TestResourceServerWithoutSearch(t *testing.T) {
	server, err := NewUninitializedResourceServer(ResourceServerOptions{
		Backend: &mockStorageBackend{},
	})
	require.NoError(t, err)
	require.Nil(t, server.search)
	t.Cleanup(func() { require.NoError(t, server.Stop(t.Context())) })
	require.NoError(t, server.Init(t.Context()))
	_, isIndexServer := any(server).(resourcepb.ResourceIndexServer)
	_, isManagedIndexServer := any(server).(resourcepb.ManagedObjectIndexServer)
	require.False(t, isIndexServer)
	require.False(t, isManagedIndexServer)
}

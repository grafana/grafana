package resourceclient

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type recordingConn struct {
	grpc.ClientConnInterface
	methods []string
}

func (c *recordingConn) Invoke(_ context.Context, method string, _, _ any, _ ...grpc.CallOption) error {
	c.methods = append(c.methods, method)
	return nil
}

func TestIndependentClients(t *testing.T) {
	storageConn, searchConn := &recordingConn{}, &recordingConn{}
	storage := NewResourceClientFromConn(storageConn)
	search := NewSearchClientFromConn(searchConn)
	_, storageHasSearch := storage.(resourcepb.ResourceIndexClient)
	_, searchHasStorage := search.(resourcepb.ResourceStoreClient)
	require.False(t, storageHasSearch)
	require.False(t, searchHasStorage)

	_, err := storage.Read(t.Context(), &resourcepb.ReadRequest{})
	require.NoError(t, err)
	_, err = search.Search(t.Context(), &resourcepb.ResourceSearchRequest{})
	require.NoError(t, err)
	_, err = search.IsHealthy(t.Context(), &resourcepb.HealthCheckRequest{})
	require.NoError(t, err)
	require.Len(t, storageConn.methods, 1)
	require.Len(t, searchConn.methods, 2)
}

func TestCombinedClientKeepsConnectionRouting(t *testing.T) {
	storageConn, searchConn := &recordingConn{}, &recordingConn{}
	client := NewResourceClientFromConns(storageConn, searchConn)
	_, err := client.Read(t.Context(), &resourcepb.ReadRequest{})
	require.NoError(t, err)
	_, err = client.Search(t.Context(), &resourcepb.ResourceSearchRequest{})
	require.NoError(t, err)
	_, err = client.IsHealthy(t.Context(), &resourcepb.HealthCheckRequest{})
	require.NoError(t, err)
	require.Len(t, storageConn.methods, 2)
	require.Len(t, searchConn.methods, 1)
}

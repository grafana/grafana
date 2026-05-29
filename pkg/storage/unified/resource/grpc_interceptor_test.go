package resource

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type panickingResourceStore struct {
	resourcepb.UnimplementedResourceStoreServer
}

func (panickingResourceStore) Read(context.Context, *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	panic("boom-unary")
}

func (panickingResourceStore) Watch(*resourcepb.WatchRequest, resourcepb.ResourceStore_WatchServer) error {
	panic("boom-stream")
}

func newRecoveryTestClient(t *testing.T) resourcepb.ResourceStoreClient {
	t.Helper()
	channel := &inprocgrpc.Channel{}
	desc := grpchan.InterceptServer(
		&resourcepb.ResourceStore_ServiceDesc,
		interceptors.UnaryPanicRecoveryInterceptor(),
		interceptors.StreamPanicRecoveryInterceptor(),
	)
	channel.RegisterService(desc, panickingResourceStore{})
	return resourcepb.NewResourceStoreClient(channel)
}

func TestPanicRecoveryInterceptor_Unary(t *testing.T) {
	client := newRecoveryTestClient(t)

	_, err := client.Read(t.Context(), &resourcepb.ReadRequest{})

	require.Error(t, err)
	require.Equal(t, codes.Internal, status.Code(err), "panic should surface as codes.Internal, got %v", err)
}

func TestPanicRecoveryInterceptor_Stream(t *testing.T) {
	client := newRecoveryTestClient(t)

	stream, err := client.Watch(t.Context(), &resourcepb.WatchRequest{})
	require.NoError(t, err, "opening the stream should succeed; the panic surfaces on Recv")

	_, err = stream.Recv()
	require.Error(t, err)
	require.Equal(t, codes.Internal, status.Code(err), "panic in stream handler should surface as codes.Internal, got %v", err)
}

package legacy

import (
	"context"
	"fmt"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageClient = (*DirectStorageClient)(nil)
)

// NewDirectStorageClient creates a client that passes requests directly to the server using the *same* context
func NewDirectStorageClient(server resource.ResourceServer) *DirectStorageClient {
	return &DirectStorageClient{server}
}

type DirectStorageClient struct {
	server resource.ResourceServer
}

// Create implements ResourceClient.
func (d *DirectStorageClient) Create(ctx context.Context, in *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	return d.server.Create(ctx, in)
}

// Delete implements ResourceClient.
func (d *DirectStorageClient) Delete(ctx context.Context, in *resourcepb.DeleteRequest, _ ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	return d.server.Delete(ctx, in)
}

// GetBlob implements ResourceClient.
func (d *DirectStorageClient) GetBlob(ctx context.Context, in *resourcepb.GetBlobRequest, _ ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	return d.server.GetBlob(ctx, in)
}

// IsHealthy implements ResourceClient.
func (d *DirectStorageClient) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, _ ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	return d.server.IsHealthy(ctx, in)
}

// List implements ResourceClient.
func (d *DirectStorageClient) List(ctx context.Context, in *resourcepb.ListRequest, _ ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return d.server.List(ctx, in)
}

// PutBlob implements ResourceClient.
func (d *DirectStorageClient) PutBlob(ctx context.Context, in *resourcepb.PutBlobRequest, _ ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	return d.server.PutBlob(ctx, in)
}

// Read implements ResourceClient.
func (d *DirectStorageClient) Read(ctx context.Context, in *resourcepb.ReadRequest, _ ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return d.server.Read(ctx, in)
}

// Update implements ResourceClient.
func (d *DirectStorageClient) Update(ctx context.Context, in *resourcepb.UpdateRequest, _ ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	return d.server.Update(ctx, in)
}

// Watch implements ResourceClient.
func (d *DirectStorageClient) Watch(_ context.Context, _ *resourcepb.WatchRequest, _ ...grpc.CallOption) (resourcepb.ResourceStore_WatchClient, error) {
	return nil, fmt.Errorf("watch not supported with direct resource client")
}

package legacy

import (
	"context"
	"fmt"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.StorageClient = (*directStorageClient)(nil)
)

// NewDirectStorageClient creates a client that passes requests directly to the server using the *same* context
func NewDirectStorageClient(server resource.StorageServer) resource.StorageClient {
	return &directStorageClient{server}
}

type directStorageClient struct {
	server resource.StorageServer
}

// Create implements StorageClient.
func (d *directStorageClient) Create(ctx context.Context, in *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	return d.server.Create(ctx, in)
}

// Delete implements StorageClient.
func (d *directStorageClient) Delete(ctx context.Context, in *resourcepb.DeleteRequest, _ ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	return d.server.Delete(ctx, in)
}

// GetBlob implements StorageClient.
func (d *directStorageClient) GetBlob(ctx context.Context, in *resourcepb.GetBlobRequest, _ ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	return d.server.GetBlob(ctx, in)
}

// IsHealthy implements StorageClient.
func (d *directStorageClient) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, _ ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	return d.server.IsHealthy(ctx, in)
}

// List implements StorageClient.
func (d *directStorageClient) List(ctx context.Context, in *resourcepb.ListRequest, _ ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return d.server.List(ctx, in)
}

// PutBlob implements StorageClient.
func (d *directStorageClient) PutBlob(ctx context.Context, in *resourcepb.PutBlobRequest, _ ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	return d.server.PutBlob(ctx, in)
}

// Read implements StorageClient.
func (d *directStorageClient) Read(ctx context.Context, in *resourcepb.ReadRequest, _ ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return d.server.Read(ctx, in)
}

// Update implements StorageClient.
func (d *directStorageClient) Update(ctx context.Context, in *resourcepb.UpdateRequest, _ ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	return d.server.Update(ctx, in)
}

// Watch implements StorageClient.
func (d *directStorageClient) Watch(_ context.Context, _ *resourcepb.WatchRequest, _ ...grpc.CallOption) (resourcepb.ResourceStore_WatchClient, error) {
	return nil, fmt.Errorf("watch not supported with direct resource client")
}

func (d *directStorageClient) BulkProcess(ctx context.Context, opts ...grpc.CallOption) (resourcepb.BulkStore_BulkProcessClient, error) {
	return nil, fmt.Errorf("BulkProcess not supported with direct resource client")
}

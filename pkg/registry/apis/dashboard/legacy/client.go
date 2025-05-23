package legacy

import (
	"context"
	"fmt"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resource.ResourceClient = (*directResourceClient)(nil)
)

// The direct client passes requests directly to the server using the *same* context
func NewDirectResourceClient(server resource.ResourceServer) resource.ResourceClient {
	return &directResourceClient{server}
}

type directResourceClient struct {
	server resource.ResourceServer
}

// Create implements ResourceClient.
func (d *directResourceClient) Create(ctx context.Context, in *resourcepb.CreateRequest, opts ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	return d.server.Create(ctx, in)
}

// Delete implements ResourceClient.
func (d *directResourceClient) Delete(ctx context.Context, in *resourcepb.DeleteRequest, opts ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	return d.server.Delete(ctx, in)
}

// GetBlob implements ResourceClient.
func (d *directResourceClient) GetBlob(ctx context.Context, in *resourcepb.GetBlobRequest, opts ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	return d.server.GetBlob(ctx, in)
}

// GetStats implements ResourceClient.
func (d *directResourceClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return d.server.GetStats(ctx, in)
}

// IsHealthy implements ResourceClient.
func (d *directResourceClient) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, opts ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	return d.server.IsHealthy(ctx, in)
}

// List implements ResourceClient.
func (d *directResourceClient) List(ctx context.Context, in *resourcepb.ListRequest, opts ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return d.server.List(ctx, in)
}

func (d *directResourceClient) ListManagedObjects(ctx context.Context, in *resourcepb.ListManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.ListManagedObjectsResponse, error) {
	return d.server.ListManagedObjects(ctx, in)
}

func (d *directResourceClient) CountManagedObjects(ctx context.Context, in *resourcepb.CountManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
	return d.server.CountManagedObjects(ctx, in)
}

// PutBlob implements ResourceClient.
func (d *directResourceClient) PutBlob(ctx context.Context, in *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	return d.server.PutBlob(ctx, in)
}

// Read implements ResourceClient.
func (d *directResourceClient) Read(ctx context.Context, in *resourcepb.ReadRequest, opts ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return d.server.Read(ctx, in)
}

// Search implements ResourceClient.
func (d *directResourceClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return d.server.Search(ctx, in)
}

// Update implements ResourceClient.
func (d *directResourceClient) Update(ctx context.Context, in *resourcepb.UpdateRequest, opts ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	return d.server.Update(ctx, in)
}

// Watch implements ResourceClient.
func (d *directResourceClient) Watch(ctx context.Context, in *resourcepb.WatchRequest, opts ...grpc.CallOption) (resourcepb.ResourceStore_WatchClient, error) {
	return nil, fmt.Errorf("watch not supported with direct resource client")
}

// BulkProcess implements resource.ResourceClient.
func (d *directResourceClient) BulkProcess(ctx context.Context, opts ...grpc.CallOption) (resourcepb.BulkStore_BulkProcessClient, error) {
	return nil, fmt.Errorf("BulkProcess not supported with direct resource client")
}

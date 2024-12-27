package legacy

import (
	"context"
	"fmt"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
func (d *directResourceClient) Create(ctx context.Context, in *resource.CreateRequest, opts ...grpc.CallOption) (*resource.CreateResponse, error) {
	return d.server.Create(ctx, in)
}

// Delete implements ResourceClient.
func (d *directResourceClient) Delete(ctx context.Context, in *resource.DeleteRequest, opts ...grpc.CallOption) (*resource.DeleteResponse, error) {
	return d.server.Delete(ctx, in)
}

// GetBlob implements ResourceClient.
func (d *directResourceClient) GetBlob(ctx context.Context, in *resource.GetBlobRequest, opts ...grpc.CallOption) (*resource.GetBlobResponse, error) {
	return d.server.GetBlob(ctx, in)
}

// GetStats implements ResourceClient.
func (d *directResourceClient) GetStats(ctx context.Context, in *resource.ResourceStatsRequest, opts ...grpc.CallOption) (*resource.ResourceStatsResponse, error) {
	return d.server.GetStats(ctx, in)
}

// History implements ResourceClient.
func (d *directResourceClient) History(ctx context.Context, in *resource.HistoryRequest, opts ...grpc.CallOption) (*resource.HistoryResponse, error) {
	return d.server.History(ctx, in)
}

// IsHealthy implements ResourceClient.
func (d *directResourceClient) IsHealthy(ctx context.Context, in *resource.HealthCheckRequest, opts ...grpc.CallOption) (*resource.HealthCheckResponse, error) {
	return d.server.IsHealthy(ctx, in)
}

// List implements ResourceClient.
func (d *directResourceClient) List(ctx context.Context, in *resource.ListRequest, opts ...grpc.CallOption) (*resource.ListResponse, error) {
	return d.server.List(ctx, in)
}

// Origin implements ResourceClient.
func (d *directResourceClient) Origin(ctx context.Context, in *resource.OriginRequest, opts ...grpc.CallOption) (*resource.OriginResponse, error) {
	return d.server.Origin(ctx, in)
}

// PutBlob implements ResourceClient.
func (d *directResourceClient) PutBlob(ctx context.Context, in *resource.PutBlobRequest, opts ...grpc.CallOption) (*resource.PutBlobResponse, error) {
	return d.server.PutBlob(ctx, in)
}

// Read implements ResourceClient.
func (d *directResourceClient) Read(ctx context.Context, in *resource.ReadRequest, opts ...grpc.CallOption) (*resource.ReadResponse, error) {
	return d.server.Read(ctx, in)
}

// Restore implements ResourceClient.
func (d *directResourceClient) Restore(ctx context.Context, in *resource.RestoreRequest, opts ...grpc.CallOption) (*resource.RestoreResponse, error) {
	return d.server.Restore(ctx, in)
}

// Search implements ResourceClient.
func (d *directResourceClient) Search(ctx context.Context, in *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	return d.server.Search(ctx, in)
}

// Update implements ResourceClient.
func (d *directResourceClient) Update(ctx context.Context, in *resource.UpdateRequest, opts ...grpc.CallOption) (*resource.UpdateResponse, error) {
	return d.server.Update(ctx, in)
}

// Watch implements ResourceClient.
func (d *directResourceClient) Watch(ctx context.Context, in *resource.WatchRequest, opts ...grpc.CallOption) (resource.ResourceStore_WatchClient, error) {
	return nil, fmt.Errorf("watch not yet supported with direct resource client")
}

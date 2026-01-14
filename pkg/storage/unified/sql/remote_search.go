package sql

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ resource.SearchServer = (*remoteSearchClient)(nil)

// remoteSearchClient wraps gRPC search clients to implement the SearchServer interface.
// This allows the storage server to delegate search operations to a remote search server.
type remoteSearchClient struct {
	conn        *grpc.ClientConn
	index       resourcepb.ResourceIndexClient
	moiClient   resourcepb.ManagedObjectIndexClient
	diagnostics resourcepb.DiagnosticsClient
}

// newRemoteSearchClient creates a new remote search client that connects to a search server at the given address.
func newRemoteSearchClient(address string) (*remoteSearchClient, error) {
	if address == "" {
		return nil, fmt.Errorf("search server address is required for remote search mode")
	}

	conn, err := grpc.NewClient(address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create gRPC connection to search server: %w", err)
	}

	return &remoteSearchClient{
		conn:        conn,
		index:       resourcepb.NewResourceIndexClient(conn),
		moiClient:   resourcepb.NewManagedObjectIndexClient(conn),
		diagnostics: resourcepb.NewDiagnosticsClient(conn),
	}, nil
}

// Init implements resource.LifecycleHooks.
// For remote search, there's nothing to initialize locally.
func (r *remoteSearchClient) Init(ctx context.Context) error {
	return nil
}

// Stop implements resource.LifecycleHooks.
// Closes the gRPC connection.
func (r *remoteSearchClient) Stop(ctx context.Context) error {
	if r.conn != nil {
		return r.conn.Close()
	}
	return nil
}

// Search implements resourcepb.ResourceIndexServer.
func (r *remoteSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return r.index.Search(ctx, req)
}

// GetStats implements resourcepb.ResourceIndexServer.
func (r *remoteSearchClient) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	return r.index.GetStats(ctx, req)
}

// RebuildIndexes implements resourcepb.ResourceIndexServer.
func (r *remoteSearchClient) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	return r.index.RebuildIndexes(ctx, req)
}

// CountManagedObjects implements resourcepb.ManagedObjectIndexServer.
func (r *remoteSearchClient) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	return r.moiClient.CountManagedObjects(ctx, req)
}

// ListManagedObjects implements resourcepb.ManagedObjectIndexServer.
func (r *remoteSearchClient) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	return r.moiClient.ListManagedObjects(ctx, req)
}

// IsHealthy implements resourcepb.DiagnosticsServer.
func (r *remoteSearchClient) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return r.diagnostics.IsHealthy(ctx, req)
}

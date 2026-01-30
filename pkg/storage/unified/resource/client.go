package resource

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	authnGrpcUtils "github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SearchClient is for interacting with unified search
type SearchClient interface {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	DiagnosticsClient
}

// StorageClient is for interacting with unified storage
type StorageClient interface {
	resourcepb.ResourceStoreClient
	resourcepb.BlobStoreClient
	resourcepb.BulkStoreClient
	DiagnosticsClient
}

// MigratorClient is for performing migrations to unified storage
type MigratorClient interface {
	resourcepb.BulkStoreClient
	GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error)
}

// QuotaClient is for quota handlers to interact with unified storage
type QuotaClient interface {
	resourcepb.QuotasClient
}

// DiagnosticsClient is for checking if resource server is healthy
type DiagnosticsClient interface {
	resourcepb.DiagnosticsClient
}

// Client is the internal implementation that wires storage, search, migration,
// quota, and diagnostics clients together behind the specific interfaces.
type Client struct {
	StorageClient
	SearchClient
	QuotaClient
	DiagnosticsClient
}

// storageClient is the internal implementation of StorageClient
type storageClient struct {
	resourcepb.ResourceStoreClient
	resourcepb.BlobStoreClient
	resourcepb.DiagnosticsClient
	resourcepb.BulkStoreClient
}

// searchClient is the internal implementation of SearchClient
type searchClient struct {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.DiagnosticsClient
}

// NewResourceClient creates a client that implements StorageClient, SearchClient, QuotaClient, and DiagnosticsClient with authentication interceptors.
func NewResourceClient(conn, indexConn grpc.ClientConnInterface, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) (*Client, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagAppPlatformGrpcClientAuth) {
		return newLegacyResourceClient(conn, indexConn), nil
	}

	clientCfg := authnGrpcUtils.ReadGrpcClientConfig(cfg)

	return newRemoteResourceClient(tracer, conn, indexConn, RemoteClientConfig{
		Token:            clientCfg.Token,
		TokenExchangeURL: clientCfg.TokenExchangeURL,
		Audiences:        []string{defaultResourceStoreAudience},
		Namespace:        clientCfg.TokenNamespace,
		AllowInsecure:    cfg.Env == setting.Dev,
	})
}

func newResourceClient(storageCc grpc.ClientConnInterface, indexCc grpc.ClientConnInterface) *Client {
	return &Client{
		StorageClient: newStorageClient(storageCc),
		SearchClient:  newSearchClient(indexCc),
		QuotaClient:   resourcepb.NewQuotasClient(storageCc),
	}
}

func (rc *Client) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return rc.SearchClient.GetStats(ctx, in, opts...)
}

func (rc *Client) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, opts ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	searchRes, errSearch := rc.SearchClient.IsHealthy(ctx, in, opts...)
	storageRes, errStorage := rc.StorageClient.IsHealthy(ctx, in, opts...)
	// join errors
	if errSearch != nil || errStorage != nil {
		return nil, fmt.Errorf("search error: %w; storage error: %w", errSearch, errStorage)
	}
	// combine results
	return &resourcepb.HealthCheckResponse{
		Status: combineHealthStatus(searchRes.Status, storageRes.Status),
	}, nil
}

func combineHealthStatus(status resourcepb.HealthCheckResponse_ServingStatus, status2 resourcepb.HealthCheckResponse_ServingStatus) resourcepb.HealthCheckResponse_ServingStatus {
	switch {
	case status == resourcepb.HealthCheckResponse_SERVING && status2 == resourcepb.HealthCheckResponse_SERVING:
		return resourcepb.HealthCheckResponse_SERVING
	case status == resourcepb.HealthCheckResponse_NOT_SERVING || status2 == resourcepb.HealthCheckResponse_NOT_SERVING:
		return resourcepb.HealthCheckResponse_NOT_SERVING
	case status == resourcepb.HealthCheckResponse_SERVICE_UNKNOWN || status2 == resourcepb.HealthCheckResponse_SERVICE_UNKNOWN:
		return resourcepb.HealthCheckResponse_SERVICE_UNKNOWN
	default:
		return resourcepb.HealthCheckResponse_UNKNOWN
	}
}

func newStorageClient(storageConnI grpc.ClientConnInterface) *storageClient {
	return &storageClient{
		ResourceStoreClient: resourcepb.NewResourceStoreClient(storageConnI),
		BlobStoreClient:     resourcepb.NewBlobStoreClient(storageConnI),
		DiagnosticsClient:   resourcepb.NewDiagnosticsClient(storageConnI),
		BulkStoreClient:     resourcepb.NewBulkStoreClient(storageConnI),
	}
}

func newSearchClient(indexConn grpc.ClientConnInterface) *searchClient {
	return &searchClient{
		ResourceIndexClient:      resourcepb.NewResourceIndexClient(indexConn),
		ManagedObjectIndexClient: resourcepb.NewManagedObjectIndexClient(indexConn),
		DiagnosticsClient:        resourcepb.NewDiagnosticsClient(indexConn),
	}
}

package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
)

// unifiedStorageFactory implements resources.ResourceStore
// and provides a new unified storage client for each request
// HACK: This logic directly connects to unified storage. We are doing this for now as there is no global
// search endpoint. But controllers, in general, should not connect directly to unified storage and instead
// go through the api server. Once there is a global search endpoint, we will switch to that here as well.
type unifiedStorageFactory struct {
	cfg       resource.RemoteResourceClientConfig
	tracer    tracing.Tracer
	conn      grpc.ClientConnInterface
	indexConn grpc.ClientConnInterface
}

func NewUnifiedStorageClientFactory(cfg resource.RemoteResourceClientConfig, address string, indexAddress string, tracer tracing.Tracer) (resources.ResourceStore, error) {
	registry := prometheus.NewPedanticRegistry()
	conn, err := unified.GrpcConn(address, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	if indexAddress == "" {
		indexAddress = address
	}

	indexConn, err := unified.GrpcConn(indexAddress, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage index gRPC connection: %w", err)
	}

	return &unifiedStorageFactory{
		tracer:    tracer,
		conn:      conn,
		indexConn: indexConn,
	}, nil
}

func (s *unifiedStorageFactory) getClient(ctx context.Context) (resource.ResourceClient, error) {
	return resource.NewRemoteResourceClient(s.tracer, s.conn, s.indexConn, s.cfg)
}

func (s *unifiedStorageFactory) CountManagedObjects(ctx context.Context, in *resourcepb.CountManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}
	return client.CountManagedObjects(ctx, in, opts...)
}

func (s *unifiedStorageFactory) ListManagedObjects(ctx context.Context, in *resourcepb.ListManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.ListManagedObjectsResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}

	return client.ListManagedObjects(ctx, in, opts...)
}

func (s *unifiedStorageFactory) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}

	return client.Search(ctx, in, opts...)
}

func (s *unifiedStorageFactory) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	client, err := s.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("get unified storage client: %w", err)
	}

	return client.GetStats(ctx, in, opts...)
}

func setupUnifiedStorageClient(cfg *setting.Cfg, tracer tracing.Tracer) (resources.ResourceStore, error) {
	// TODO: This is duplicate
	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	tokenNamespace := gRPCAuth.Key("token_namespace").String()
	allowInsecure := gRPCAuth.Key("allow_insecure").MustBool(false)

	unifiedStorageSec := cfg.SectionWithEnvOverrides("unified_storage")
	address := unifiedStorageSec.Key("grpc_address").String()
	if address == "" {
		return nil, fmt.Errorf("grpc_address is required in [unified_storage] section")
	}

	// Optional separate index address
	indexAddress := unifiedStorageSec.Key("grpc_index_address").String()
	unifiedCfg := resource.RemoteResourceClientConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
		// TODO: why do we get this?
		// Audiences:     unifiedStorageSec.Key("grpc_client_authentication_audiences").Strings(","),
		Namespace:     tokenNamespace,
		AllowInsecure: allowInsecure,
	}

	unified, err := NewUnifiedStorageClientFactory(
		unifiedCfg,
		address,
		indexAddress,
		tracer,
	)
	if err != nil {
		return nil, fmt.Errorf("create unified storage client: %w", err)
	}

	return unified, nil
}

package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

func NewUnifiedStorageClientFactory(cfg unifiedStorageConfig, tracer tracing.Tracer) (resources.ResourceStore, error) {
	registry := prometheus.NewPedanticRegistry()
	conn, err := unified.GrpcConn(cfg.GrpcAddress, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	indexAddress := cfg.GrpcIndexAddress
	if indexAddress == "" {
		indexAddress = cfg.GrpcAddress
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

package sql

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// HealthChecker is an interface for servers that can provide health status.
type HealthChecker interface {
	resourcepb.DiagnosticsServer
}

// SubservicesState holds the subservices manager and watcher state.
type SubservicesState struct {
	Manager        *services.Manager
	Watcher        *services.FailureWatcher
	HasSubservices bool
}

// InitSubservicesManager creates a new subservices manager and watcher from the given services.
// Returns a state with HasSubservices=false if no services are provided.
func InitSubservicesManager(subservices []services.Service) (*SubservicesState, error) {
	state := &SubservicesState{
		Watcher: services.NewFailureWatcher(),
	}

	if len(subservices) == 0 {
		return state, nil
	}

	var err error
	state.Manager, err = services.NewManager(subservices...)
	if err != nil {
		return nil, fmt.Errorf("failed to create subservices manager: %w", err)
	}
	state.HasSubservices = true

	return state, nil
}

// StartSubservices starts the subservices and waits for them to be healthy.
// Does nothing if no subservices are configured.
func (s *SubservicesState) StartSubservices(ctx context.Context) error {
	if !s.HasSubservices {
		return nil
	}

	s.Watcher.WatchManager(s.Manager)
	if err := services.StartManagerAndAwaitHealthy(ctx, s.Manager); err != nil {
		return fmt.Errorf("failed to start subservices: %w", err)
	}

	return nil
}

// StopSubservices stops the subservices and waits for them to stop.
// Does nothing if no subservices are configured.
func (s *SubservicesState) StopSubservices() error {
	if !s.HasSubservices {
		return nil
	}

	err := services.StopManagerAndAwaitStopped(context.Background(), s.Manager)
	if err != nil {
		return fmt.Errorf("failed to stop subservices: %w", err)
	}

	return nil
}

// CreateGrpcHandler creates a new gRPC server handler with the standard configuration.
func CreateGrpcHandler(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	authenticator func(ctx context.Context) (context.Context, error),
	tracer trace.Tracer,
) (grpcserver.Provider, error) {
	return grpcserver.ProvideService(cfg, features, interceptors.AuthenticatorFunc(authenticator), tracer, prometheus.DefaultRegisterer)
}

// RegisterHealthAndReflection registers the health check and reflection services on the gRPC server.
func RegisterHealthAndReflection(
	cfg *setting.Cfg,
	handler grpcserver.Provider,
	healthChecker HealthChecker,
) error {
	healthService, err := resource.ProvideHealthService(healthChecker)
	if err != nil {
		return err
	}

	grpc_health_v1.RegisterHealthServer(handler.GetServer(), healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(cfg, handler)
	if err != nil {
		return err
	}

	return nil
}

// CreateAuthzClient creates a standalone authorization client.
func CreateAuthzClient(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tracer trace.Tracer,
	reg prometheus.Registerer,
) (types.AccessClient, error) {
	return authz.ProvideStandaloneAuthZClient(cfg, features, tracer, reg)
}

// CreateOverridesService creates an overrides service if configured.
// Returns nil if no overrides file path is configured.
func CreateOverridesService(
	ctx context.Context,
	cfg *setting.Cfg,
	logger log.Logger,
	reg prometheus.Registerer,
	tracer trace.Tracer,
) (*resource.OverridesService, error) {
	if cfg.OverridesFilePath == "" {
		return nil, nil
	}

	return resource.NewOverridesService(ctx, logger, reg, tracer, resource.ReloadOptions{
		FilePath:     cfg.OverridesFilePath,
		ReloadPeriod: cfg.OverridesReloadInterval,
	})
}

// RegisterStorageServices registers the storage-related gRPC services on the server.
func RegisterStorageServices(cfg *setting.Cfg, handler grpcserver.Provider, server resource.StorageServer) error {
	srv := handler.GetServer()
	resourcepb.RegisterResourceStoreServer(srv, server)
	resourcepb.RegisterBulkStoreServer(srv, server)
	resourcepb.RegisterBlobStoreServer(srv, server)
	resourcepb.RegisterDiagnosticsServer(srv, server)
	resourcepb.RegisterQuotasServer(srv, server)
	return RegisterHealthAndReflection(cfg, handler, server)
}

// RegisterSearchServices registers the search-related gRPC services on the server.
func RegisterSearchServices(cfg *setting.Cfg, handler grpcserver.Provider, server resource.SearchServer) error {
	srv := handler.GetServer()
	resourcepb.RegisterResourceIndexServer(srv, server)
	resourcepb.RegisterManagedObjectIndexServer(srv, server)
	resourcepb.RegisterDiagnosticsServer(srv, server)
	return RegisterHealthAndReflection(cfg, handler, server)
}

// RegisterUnifiedServices registers both storage and search gRPC services on the server.
// This is used by the deprecated ProvideUnifiedStorageGrpcService for monolith mode.
func RegisterUnifiedServices(cfg *setting.Cfg, handler grpcserver.Provider, server resource.ResourceServer) error {
	srv := handler.GetServer()
	// Register storage services
	resourcepb.RegisterResourceStoreServer(srv, server)
	resourcepb.RegisterBulkStoreServer(srv, server)
	resourcepb.RegisterBlobStoreServer(srv, server)
	resourcepb.RegisterDiagnosticsServer(srv, server)
	resourcepb.RegisterQuotasServer(srv, server)
	// Register search services
	resourcepb.RegisterResourceIndexServer(srv, server)
	resourcepb.RegisterManagedObjectIndexServer(srv, server)
	return RegisterHealthAndReflection(cfg, handler, server)
}

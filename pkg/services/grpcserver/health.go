package grpcserver

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// HealthProbe can be implemented by services to provide custom health checks.
// The probe is polled periodically while the service manager is healthy.
type HealthProbe interface {
	CheckHealth(ctx context.Context) (bool, error)
}

// HealthProbeFunc implements HealthProbe.
type HealthProbeFunc func(ctx context.Context) (bool, error)

func (f HealthProbeFunc) CheckHealth(ctx context.Context) (bool, error) { return f(ctx) }

// probeEntry associates a HealthProbe with the gRPC service names it covers.
type probeEntry struct {
	probe        HealthProbe
	serviceNames []string
}

// HealthService implements GRPC Health Checking Protocol:
// https://github.com/grpc/grpc/blob/master/doc/health-checking.md
// It tracks per-service health status and computes an aggregate status
// on the "" key.
// It also demonstrates how to override authentication for a service – in this
// case we are disabling any auth in AuthFuncOverride.
type HealthService struct {
	server     *health.Server
	logger     log.Logger
	runningCtx context.Context
	cancel     context.CancelFunc

	// probes contains registered health probes.
	probes []probeEntry

	mu       sync.Mutex
	statuses map[string]grpc_health_v1.HealthCheckResponse_ServingStatus
}

// ProvideHealthService is a wire provider that creates a HealthService and
// registers it on the gRPC server.
func ProvideHealthService(grpcServerProvider Provider) *HealthService {
	hs := newHealthService()
	grpc_health_v1.RegisterHealthServer(grpcServerProvider.GetServer(), hs)
	return hs
}

func newHealthService() *HealthService {
	runningCtx, cancel := context.WithCancel(context.Background())
	return &HealthService{
		server:     health.NewServer(),
		statuses:   make(map[string]grpc_health_v1.HealthCheckResponse_ServingStatus),
		logger:     log.New("health-service"),
		runningCtx: runningCtx,
		cancel:     cancel,
	}
}

// AuthFuncOverride for no auth for health service.
func (s *HealthService) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

// Check delegates to the underlying health server.
func (s *HealthService) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	return s.server.Check(ctx, req)
}

// Watch delegates to the underlying health server.
func (s *HealthService) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	return s.server.Watch(req, stream)
}

// List delegates to the underlying health server.
func (s *HealthService) List(ctx context.Context, req *grpc_health_v1.HealthListRequest) (*grpc_health_v1.HealthListResponse, error) {
	return s.server.List(ctx, req)
}

// Shutdown sets all serving status to NOT_SERVING and notifies watchers.
func (s *HealthService) Shutdown() {
	s.logger.Info("Shutting down health service, setting all registered services to NOT_SERVING")
	s.cancel()
	s.server.Shutdown()
}

// SetServingStatus updates the status of a named service and recomputes the
// aggregate status on the "" key.
func (s *HealthService) SetServingStatus(service string, st grpc_health_v1.HealthCheckResponse_ServingStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if service != "" {
		s.statuses[service] = st
		s.server.SetServingStatus(service, st)
	}
	s.server.SetServingStatus("", s.aggregateStatusLocked())
}

func (s *HealthService) aggregateStatusLocked() grpc_health_v1.HealthCheckResponse_ServingStatus {
	if len(s.statuses) == 0 {
		return grpc_health_v1.HealthCheckResponse_NOT_SERVING
	}
	for _, st := range s.statuses {
		if st != grpc_health_v1.HealthCheckResponse_SERVING {
			return st
		}
	}
	return grpc_health_v1.HealthCheckResponse_SERVING
}

// Register maps a HealthProbe to one or more gRPC service names.
// Register Must be called before the service manager starts (during module init).
// All registered services start as NOT_SERVING until Healthy is called (by the service manager).
func (s *HealthService) Register(probe HealthProbe, serviceNames ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.probes = append(s.probes, probeEntry{probe: probe, serviceNames: serviceNames})
	for _, name := range serviceNames {
		s.statuses[name] = grpc_health_v1.HealthCheckResponse_NOT_SERVING
		s.server.SetServingStatus(name, grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	}
	s.server.SetServingStatus("", s.aggregateStatusLocked())
}

// Healthy implements services.ManagerListener. Called when all managed services
// reach Running state. Runs an immediate poll and starts the periodic poll loop.
func (s *HealthService) Healthy() {
	s.mu.Lock()
	hasProbes := len(s.probes) > 0
	s.mu.Unlock()

	if !hasProbes {
		return
	}
	s.logger.Info("Service manager reported healthy, starting health check loop", "probes", len(s.probes))
	s.checkAll()
	go s.pollLoop()
}

// Stopped implements services.ManagerListener. No-op
func (s *HealthService) Stopped() {}

// Failure implements services.ManagerListener. No-op
func (s *HealthService) Failure(_ services.Service) {}

func (s *HealthService) pollLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.checkAll()
		case <-s.runningCtx.Done():
			s.logger.Info("Health checker loop stopped")
			return
		}
	}
}

func (s *HealthService) checkAll() {
	s.mu.Lock()
	probes := s.probes
	s.mu.Unlock()

	for _, entry := range probes {
		pollCtx, cancel := context.WithTimeout(s.runningCtx, 5*time.Second)
		healthy, err := entry.probe.CheckHealth(pollCtx)
		cancel()

		if err != nil {
			s.logger.Warn("Health probe failed", "services", entry.serviceNames, "error", err)
		}

		st := grpc_health_v1.HealthCheckResponse_SERVING
		if !healthy {
			st = grpc_health_v1.HealthCheckResponse_NOT_SERVING
		}
		for _, name := range entry.serviceNames {
			s.SetServingStatus(name, st)
		}
	}
}

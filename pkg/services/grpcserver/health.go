package grpcserver

import (
	"context"
	"sync"
	"time"

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
	// probes is the list of registered probes, each called once per poll cycle.
	probes []HealthProbe
	// serviceProbeIdx maps each gRPC service name to indices into the probes.
	serviceProbeIdx map[string][]int

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
		server:          health.NewServer(),
		statuses:        make(map[string]grpc_health_v1.HealthCheckResponse_ServingStatus),
		serviceProbeIdx: make(map[string][]int),
		logger:          log.New("health-service"),
		runningCtx:      runningCtx,
		cancel:          cancel,
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

// setServingStatus updates the status of a named service and recomputes the
// aggregate status on the "" key.
func (s *HealthService) setServingStatus(service string, st grpc_health_v1.HealthCheckResponse_ServingStatus) {
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
// Register Must be called before Start.
// All registered services start as NOT_SERVING until Start is called.
func (s *HealthService) Register(probe HealthProbe, serviceNames ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := len(s.probes)
	s.probes = append(s.probes, probe)
	for _, name := range serviceNames {
		s.serviceProbeIdx[name] = append(s.serviceProbeIdx[name], idx)
		s.statuses[name] = grpc_health_v1.HealthCheckResponse_NOT_SERVING
		s.server.SetServingStatus(name, grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	}
	s.server.SetServingStatus("", s.aggregateStatusLocked())
}

// start runs an immediate poll and starts the periodic poll loop.
func (s *HealthService) start() {
	if len(s.probes) == 0 {
		return
	}
	s.logger.Info("Service manager reported healthy, starting health check loop", "probes", len(s.probes))
	s.checkAll()
	go s.pollLoop()
}

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
	results := make([]bool, len(s.probes))
	for i, probe := range s.probes {
		pollCtx, cancel := context.WithTimeout(s.runningCtx, 5*time.Second)
		healthy, err := probe.CheckHealth(pollCtx)
		cancel()
		if err != nil {
			s.logger.Warn("Health probe failed", "error", err)
		}
		results[i] = healthy
	}

	// A service is SERVING only if all its probes are healthy.
	for name, indices := range s.serviceProbeIdx {
		healthy := true
		for _, idx := range indices {
			if !results[idx] {
				healthy = false
				break
			}
		}
		st := grpc_health_v1.HealthCheckResponse_SERVING
		if !healthy {
			st = grpc_health_v1.HealthCheckResponse_NOT_SERVING
		}
		s.setServingStatus(name, st)
	}
}

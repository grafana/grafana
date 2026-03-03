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

// HealthProbe can be implemented by services to provide custom health checks during their Running state.
type HealthProbe interface {
	CheckHealth(ctx context.Context) bool
}

// HealthService implements GRPC Health Checking Protocol:
// https://github.com/grpc/grpc/blob/master/doc/health-checking.md
// It tracks per-service health status and computes an aggregate status
// on the "" key.
// It also demonstrates how to override authentication for a service – in this
// case we are disabling any auth in AuthFuncOverride.
type HealthService struct {
	server *health.Server
	logger log.Logger
	cancel context.CancelFunc

	// probeServices contains services that implement HealthProbe.
	probeServices []probeService

	mu       sync.Mutex
	statuses map[string]grpc_health_v1.HealthCheckResponse_ServingStatus
}

type probeService struct {
	name    string
	service services.Service
	probe   HealthProbe
}

// ProvideHealthService is a wire provider that creates a HealthService and
// registers it on the gRPC server.
func ProvideHealthService(grpcServerProvider Provider) *HealthService {
	hs := newHealthService()
	grpc_health_v1.RegisterHealthServer(grpcServerProvider.GetServer(), hs)
	return hs
}

func newHealthService() *HealthService {
	return &HealthService{
		server:   health.NewServer(),
		statuses: make(map[string]grpc_health_v1.HealthCheckResponse_ServingStatus),
		logger:   log.New("health-service"),
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

// AddHealthListener adds a service listener that will update
// the gRPC health status based on service state transitions.
// Services can implement HealthProbe for health checks during running state.
// Services should be registered before the manager is started
func (s *HealthService) AddHealthListener(name string, svc services.Service) {
	healthProbe, hasHealthProbe := svc.(HealthProbe)
	s.logger.Info("Registering health listener", "service", name, "hasProbe", hasHealthProbe)
	s.SetServingStatus(name, grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	runningFn := func() {
		s.logger.Debug("Service is running, SERVING", "service", name)
		s.SetServingStatus(name, grpc_health_v1.HealthCheckResponse_SERVING)
	}
	notServingFn := func(from services.State) {
		s.logger.Debug("Service is no longer running, NOT_SERVING", "service", name, "fromState", from)
		s.SetServingStatus(name, grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	}
	svc.AddListener(services.NewListener(
		nil, // Starting — no-op
		runningFn,
		notServingFn, // Stopping
		notServingFn, // Terminated
		func(from services.State, err error) {
			s.logger.Debug("Service failed, NOT_SERVING", "service", name, "fromState", from, "error", err)
			notServingFn(from)
		},
	))
	if healthProbe != nil {
		s.probeServices = append(s.probeServices, probeService{name: name, service: svc, probe: healthProbe})
	}
}

// Healthy implements services.ManagerListener. Called when all managed services
// reach Running state. Starts the poll loop if any HealthProbe services exist.
func (s *HealthService) Healthy() {
	if len(s.probeServices) == 0 {
		return
	}
	s.logger.Debug("Service manager healthy, starting health check loop", "probeServices", len(s.probeServices))
	s.pollServices(context.Background())
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go s.pollLoop(ctx)
}

// Stopped implements services.ManagerListener.
func (s *HealthService) Stopped() {
	s.logger.Debug("Service manager stopped, shutting down health server")
	if s.cancel != nil {
		s.cancel()
	}
	s.Shutdown()
}

// Failure implements services.ManagerListener. When any managed service fails
// the manager will shut down all services, so we mark everything NOT_SERVING.
func (s *HealthService) Failure(_ services.Service) {
	s.logger.Info("Service manager failure, shutting down health server")
	if s.cancel != nil {
		s.cancel()
	}
	s.Shutdown()
}

func (s *HealthService) pollLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.pollServices(ctx)
		case <-ctx.Done():
			s.logger.Debug("health checker loop stopped")
			return
		}
	}
}

func (s *HealthService) pollServices(ctx context.Context) {
	for _, e := range s.probeServices {
		if e.service.State() != services.Running {
			continue
		}
		pollCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		if e.probe.CheckHealth(pollCtx) {
			s.SetServingStatus(e.name, grpc_health_v1.HealthCheckResponse_SERVING)
		} else {
			s.SetServingStatus(e.name, grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		}
		cancel()
	}
}

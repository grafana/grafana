package grpcserver

import (
	"context"
	"sync"

	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/setting"
)

// HealthService implements GRPC Health Checking Protocol:
// https://github.com/grpc/grpc/blob/master/doc/health-checking.md
// It tracks per-service health status and computes an aggregate status
// on the "" key.
// It also demonstrates how to override authentication for a service – in this
// case we are disabling any auth in AuthFuncOverride.
type HealthService struct {
	*health.Server
	mu       sync.Mutex
	statuses map[string]grpc_health_v1.HealthCheckResponse_ServingStatus
}

type Option func(*HealthService)

func WithInitialStatuses(statuses map[string]grpc_health_v1.HealthCheckResponse_ServingStatus) Option {
	return func(s *HealthService) {
		for service, st := range statuses {
			s.SetServingStatus(service, st)
		}
	}
}

func ProvideHealthService(_ *setting.Cfg, grpcServerProvider Provider) (*HealthService, error) {
	return ProvideHealthServiceWithOpts(grpcServerProvider)
}

func ProvideHealthServiceWithOpts(grpcServerProvider Provider, opts ...Option) (*HealthService, error) {
	service := &HealthService{
		Server:   health.NewServer(),
		statuses: make(map[string]grpc_health_v1.HealthCheckResponse_ServingStatus),
	}
	for _, opt := range opts {
		opt(service)
	}
	grpc_health_v1.RegisterHealthServer(grpcServerProvider.GetServer(), service)
	return service, nil
}

// AuthFuncOverride for no auth for health service.
func (s *HealthService) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

// SetServingStatus updates the status of a named service and recomputes the
// aggregate status on the "" key.
func (s *HealthService) SetServingStatus(service string, st grpc_health_v1.HealthCheckResponse_ServingStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if service == "" {
		s.Server.SetServingStatus("", s.aggregateStatusLocked())
		return
	}

	s.statuses[service] = st
	s.Server.SetServingStatus(service, st)
	s.Server.SetServingStatus("", s.aggregateStatusLocked())
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

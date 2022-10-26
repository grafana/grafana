package grpcserver

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/setting"

	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// HealthService implements GRPC Health Checking Protocol:
// https://github.com/grpc/grpc/blob/master/doc/health-checking.md
// It also demonstrates how to override authentication for a service – in this
// case we are disabling any auth in AuthFuncOverride.
type HealthService struct {
	*services.BasicService
	cfg          *setting.Cfg
	healthServer *healthServer
}

func ProvideHealthService(cfg *setting.Cfg, grpcServerProvider Provider) (*HealthService, error) {
	hs := &healthServer{health.NewServer()}
	grpc_health_v1.RegisterHealthServer(grpcServerProvider.GetServer(), hs)
	s := &HealthService{
		cfg:          cfg,
		healthServer: hs,
	}
	s.BasicService = services.NewIdleService(nil, nil)
	return s, nil
}

type healthServer struct {
	*health.Server
}

// AuthFuncOverride for no auth for health service.
func (s *healthServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

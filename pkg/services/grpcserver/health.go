package grpcserver

import (
	"context"

	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/setting"
)

// HealthService implements GRPC Health Checking Protocol:
// https://github.com/grpc/grpc/blob/master/doc/health-checking.md
// It also demonstrates how to override authentication for a service – in this
// case we are disabling any auth in AuthFuncOverride.
type HealthService struct {
	cfg          *setting.Cfg
	healthServer *healthServer
}

type healthServer struct {
	*health.Server
}

// AuthFuncOverride for no auth for health service.
func (s *healthServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

func ProvideHealthService(cfg *setting.Cfg, grpcServerProvider Provider) (*HealthService, error) {
	hs := &healthServer{health.NewServer()}
	grpc_health_v1.RegisterHealthServer(grpcServerProvider.GetServer(), hs)
	return &HealthService{
		cfg:          cfg,
		healthServer: hs,
	}, nil
}

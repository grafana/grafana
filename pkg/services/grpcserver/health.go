package grpcserver

import (
	"context"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"

	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
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

func (s *HealthService) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *HealthService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrpcServer)
}

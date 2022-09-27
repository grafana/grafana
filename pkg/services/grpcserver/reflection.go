package grpcserver

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"

	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/reflection/grpc_reflection_v1alpha"
)

// ReflectionService implements GRPC Reflection Checking Protocol:
type ReflectionService struct {
	cfg              *setting.Cfg
	reflectionServer *reflectionServer
}

type reflectionServer struct {
	grpc_reflection_v1alpha.ServerReflectionServer
}

// AuthFuncOverride no auth for reflection service.
func (s *reflectionServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

func ProvideReflectionService(cfg *setting.Cfg, grpcServerProvider Provider) (*ReflectionService, error) {
	re := &reflectionServer{reflection.NewServer(reflection.ServerOptions{Services: grpcServerProvider.GetServer()})}
	grpc_reflection_v1alpha.RegisterServerReflectionServer(grpcServerProvider.GetServer(), re)
	return &ReflectionService{
		cfg:              cfg,
		reflectionServer: re,
	}, nil
}

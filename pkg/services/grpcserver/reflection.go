package grpcserver

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/reflection/grpc_reflection_v1alpha"

	"github.com/grafana/grafana/pkg/setting"
)

// ReflectionService implements the gRPC Server Reflection Protocol:
// https://github.com/grpc/grpc/blob/master/doc/server-reflection.md
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

// RegisterReflection registers the reflection service on the provided gRPC server.
func RegisterReflection(srv *grpc.Server) {
	re := &reflectionServer{reflection.NewServer(reflection.ServerOptions{Services: srv})}
	grpc_reflection_v1alpha.RegisterServerReflectionServer(srv, re)
}

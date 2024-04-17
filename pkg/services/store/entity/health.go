package entity

import (
	"context"

	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// Compile-time assertion
var _ HealthService = &healthServer{}

type HealthService interface {
	grpc_health_v1.HealthServer
	grpcAuth.ServiceAuthFuncOverride
}

type InitializableEntityServer interface {
	EntityStoreServer
	Init() error
}

func ProvideHealthService(server InitializableEntityServer) (grpc_health_v1.HealthServer, error) {
	h := &healthServer{entityServer: server}
	return h, nil
}

type healthServer struct {
	entityServer InitializableEntityServer
}

// AuthFuncOverride for no auth for health service.
func (s *healthServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

func (s *healthServer) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	if s.entityServer.Init() != nil {
		return &grpc_health_v1.HealthCheckResponse{
			Status: grpc_health_v1.HealthCheckResponse_NOT_SERVING,
		}, nil
	} else {
		return &grpc_health_v1.HealthCheckResponse{
			Status: grpc_health_v1.HealthCheckResponse_SERVING,
		}, nil
	}
}

func (s *healthServer) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	// TODO
	return nil
}

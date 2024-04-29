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

func ProvideHealthService(server EntityStoreServer) (grpc_health_v1.HealthServer, error) {
	h := &healthServer{entityServer: server}
	return h, nil
}

type healthServer struct {
	entityServer EntityStoreServer
}

// AuthFuncOverride for no auth for health service.
func (s *healthServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

func (s *healthServer) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	h, err := s.entityServer.IsHealthy(ctx, &HealthRequest{})
	if err != nil {
		return nil, err
	}

	if h.Healthy {
		return healthyResponse(), nil
	} else {
		return unhealthyResponse(), nil
	}
}

func (s *healthServer) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	h, err := s.entityServer.IsHealthy(stream.Context(), &HealthRequest{})
	if err != nil {
		return err
	}

	if h.Healthy {
		if err := stream.Send(healthyResponse()); err != nil {
			return err
		}
	} else {
		if err := stream.Send(unhealthyResponse()); err != nil {
			return err
		}
	}
	return nil
}

func healthyResponse() *grpc_health_v1.HealthCheckResponse {
	return &grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_SERVING,
	}
}

func unhealthyResponse() *grpc_health_v1.HealthCheckResponse {
	return &grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_NOT_SERVING,
	}
}

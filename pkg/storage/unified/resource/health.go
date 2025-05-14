package resource

import (
	"context"
	"errors"
	"time"

	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// Compile-time assertion
var _ HealthService = &healthServer{}

type HealthService interface {
	grpc_health_v1.HealthServer
	grpcAuth.ServiceAuthFuncOverride
}

func ProvideHealthService(server DiagnosticsServer) (grpc_health_v1.HealthServer, error) {
	h := &healthServer{srv: server}
	return h, nil
}

type healthServer struct {
	srv DiagnosticsServer
}

// AuthFuncOverride for no auth for health service.
func (s *healthServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

func (s *healthServer) List(ctx context.Context, req *grpc_health_v1.HealthListRequest) (*grpc_health_v1.HealthListResponse, error) {
	h, err := s.Check(ctx, &grpc_health_v1.HealthCheckRequest{
		Service: "all", // not used for anything
	})
	if err != nil {
		return nil, err
	}
	return &grpc_health_v1.HealthListResponse{
		Statuses: map[string]*grpc_health_v1.HealthCheckResponse{
			"all": h,
		},
	}, nil
}

func (s *healthServer) Check(ctx context.Context, req *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	r, err := s.srv.IsHealthy(ctx, &HealthCheckRequest{})
	if err != nil {
		return nil, err
	}

	return &grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_ServingStatus(r.Status.Number()),
	}, nil
}

func (s *healthServer) Watch(req *grpc_health_v1.HealthCheckRequest, stream grpc_health_v1.Health_WatchServer) error {
	h, err := s.srv.IsHealthy(stream.Context(), &HealthCheckRequest{})
	if err != nil {
		return err
	}

	// send initial health status
	err = stream.Send(&grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_ServingStatus(h.Status.Number()),
	})
	if err != nil {
		return err
	}

	currHealth := h.Status.Number()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			// get current health status
			h, err := s.srv.IsHealthy(stream.Context(), &HealthCheckRequest{})
			if err != nil {
				return err
			}

			// if health status has not changed, continue
			if h.Status.Number() == currHealth {
				continue
			}

			// send the new health status
			currHealth = h.Status.Number()
			err = stream.Send(&grpc_health_v1.HealthCheckResponse{
				Status: grpc_health_v1.HealthCheckResponse_ServingStatus(h.Status.Number()),
			})
			if err != nil {
				return err
			}
		case <-stream.Context().Done():
			return errors.New("stream closed, context cancelled")
		}
	}
}

package server

import (
	"context"
	"errors"
	"time"

	grpcauth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"
)

type DiagnosticServer interface {
	IsHealthy(ctx context.Context) (bool, error)
}

func NewHealthServer(target DiagnosticServer) *HealthServer {
	return &HealthServer{target: target}
}

type HealthServer struct {
	healthv1pb.UnimplementedHealthServer
	target DiagnosticServer
}

var _ grpcauth.ServiceAuthFuncOverride = (*HealthServer)(nil)

func (s *HealthServer) AuthFuncOverride(ctx context.Context, fullMethodName string) (context.Context, error) {
	return ctx, nil
}

func (s *HealthServer) Check(ctx context.Context, req *healthv1pb.HealthCheckRequest) (*healthv1pb.HealthCheckResponse, error) {
	healthy, err := s.target.IsHealthy(ctx)
	if err != nil || !healthy {
		return &healthv1pb.HealthCheckResponse{Status: healthv1pb.HealthCheckResponse_NOT_SERVING}, err
	}
	return &healthv1pb.HealthCheckResponse{Status: healthv1pb.HealthCheckResponse_SERVING}, nil
}

func (s *HealthServer) Watch(req *healthv1pb.HealthCheckRequest, stream healthv1pb.Health_WatchServer) error {
	res, err := s.Check(stream.Context(), &healthv1pb.HealthCheckRequest{})
	if err != nil {
		return err
	}

	err = stream.Send(res)
	if err != nil {
		return err
	}

	prevStatus := res.GetStatus()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			res, err := s.Check(stream.Context(), &healthv1pb.HealthCheckRequest{})
			if err != nil {
				return err
			}

			// if health status has not changed, continue
			if res.GetStatus() == prevStatus {
				continue
			}

			prevStatus = res.GetStatus()
			err = stream.Send(res)
			if err != nil {
				return err
			}

		case <-stream.Context().Done():
			return errors.New("stream closed, context cancelled")
		}
	}
}

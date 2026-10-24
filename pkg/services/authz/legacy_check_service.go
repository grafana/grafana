package authz

import (
	"context"

	legacyv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"google.golang.org/grpc"
)

type legacyCheckServer interface {
	LegacyCheck(context.Context, *legacyv1.LegacyCheckRequest) (*legacyv1.LegacyCheckResponse, error)
}

// Only LegacyCheck is exposed on the shared connection. The private legacy
// enumeration service accepts trusted assertions and must remain in-process.
func registerLegacyCheckService(registrar grpc.ServiceRegistrar, server legacyCheckServer) {
	legacyv1.RegisterLegacyAuthzServiceServer(registrar, &legacyCheckOnlyServer{legacyCheckServer: server})
}

type legacyCheckOnlyServer struct {
	legacyv1.UnimplementedLegacyAuthzServiceServer
	legacyCheckServer
}

func (s *legacyCheckOnlyServer) LegacyCheck(ctx context.Context, req *legacyv1.LegacyCheckRequest) (*legacyv1.LegacyCheckResponse, error) {
	return s.legacyCheckServer.LegacyCheck(ctx, req)
}

package resource

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resourcepb.DiagnosticsServer = (*noopService)(nil)
)

// noopService is a helper implementation to simplify tests
// It does nothing except return errors when asked to do anything real
type noopService struct{}

// IsHealthy implements DiagnosticsServer
func (n *noopService) IsHealthy(context.Context, *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return &resourcepb.HealthCheckResponse{
		Status: resourcepb.HealthCheckResponse_SERVING,
	}, nil
}

func (n *noopService) Read(context.Context, *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	return nil, ErrNotImplementedYet
}

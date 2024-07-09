package resource

import (
	"context"
)

var (
	_ DiagnosticsServer = &noopService{}
	_ LifecycleHooks    = &noopService{}
)

// noopService is a helper implementation to simplify tests
// It does nothing except return errors when asked to do anything real
type noopService struct{}

// Init implements ResourceServer.
func (n *noopService) Init() error {
	return nil
}

// Stop implements ResourceServer.
func (n *noopService) Stop() {
	// nothing
}

// IsHealthy implements ResourceServer.
func (n *noopService) IsHealthy(context.Context, *HealthCheckRequest) (*HealthCheckResponse, error) {
	return &HealthCheckResponse{
		Status: HealthCheckResponse_SERVING,
	}, nil
}

// Read implements ResourceServer.
func (n *noopService) Read(context.Context, *ReadRequest) (*ReadResponse, error) {
	return nil, ErrNotImplementedYet
}

// List implements ResourceServer.
func (n *noopService) List(context.Context, *ListRequest) (*ListResponse, error) {
	return nil, ErrNotImplementedYet
}

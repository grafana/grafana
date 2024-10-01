package resource

import (
	"context"
)

var (
	_ DiagnosticsServer   = (*noopService)(nil)
	_ ResourceIndexServer = (*noopService)(nil)
	_ LifecycleHooks      = (*noopService)(nil)
)

// noopService is a helper implementation to simplify tests
// It does nothing except return errors when asked to do anything real
type noopService struct{}

// Init implements LifecycleHooks.
func (n *noopService) Init(context.Context) error {
	return nil
}

// Stop implements LifecycleHooks.
func (n *noopService) Stop(context.Context) error {
	return nil
}

// IsHealthy implements DiagnosticsServer
func (n *noopService) IsHealthy(context.Context, *HealthCheckRequest) (*HealthCheckResponse, error) {
	return &HealthCheckResponse{
		Status: HealthCheckResponse_SERVING,
	}, nil
}

func (n *noopService) Read(context.Context, *ReadRequest) (*ReadResponse, error) {
	return nil, ErrNotImplementedYet
}

func (n *noopService) Search(context.Context, *SearchRequest) (*SearchResponse, error) {
	return nil, ErrNotImplementedYet
}

func (n *noopService) History(context.Context, *HistoryRequest) (*HistoryResponse, error) {
	return nil, ErrNotImplementedYet
}

func (n *noopService) Origin(context.Context, *OriginRequest) (*OriginResponse, error) {
	return nil, ErrNotImplementedYet
}

package resource

import "context"

var (
	_ ResourceSearchServer = &NoopServer{}
	_ DiagnosticsServer    = &NoopServer{}
	_ LifecycleHooks       = &NoopServer{}
)

type NoopServer struct{}

// Init implements ResourceServer.
func (n *NoopServer) Init() error {
	return nil
}

// Stop implements ResourceServer.
func (n *NoopServer) Stop() {
	// nothing
}

// IsHealthy implements ResourceServer.
func (n *NoopServer) IsHealthy(context.Context, *HealthCheckRequest) (*HealthCheckResponse, error) {
	return &HealthCheckResponse{
		Status: HealthCheckResponse_SERVING,
	}, nil
}

// Read implements ResourceServer.
func (n *NoopServer) Read(context.Context, *ReadRequest) (*ReadResponse, error) {
	return nil, ErrNotImplementedYet
}

// List implements ResourceServer.
func (n *NoopServer) List(context.Context, *ListRequest) (*ListResponse, error) {
	return nil, ErrNotImplementedYet
}

// GetBlob implements ResourceServer.
func (n *NoopServer) GetBlob(context.Context, *GetBlobRequest) (*GetBlobResponse, error) {
	return nil, ErrNotImplementedYet
}

// History implements ResourceServer.
func (n *NoopServer) History(context.Context, *HistoryRequest) (*HistoryResponse, error) {
	return nil, ErrNotImplementedYet
}

// Origin implements ResourceServer.
func (n *NoopServer) Origin(context.Context, *OriginRequest) (*OriginResponse, error) {
	return nil, ErrNotImplementedYet
}

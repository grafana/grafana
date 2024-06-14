package resource

import "context"

var _ ResourceServer = &NoopServer{}

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

// Create implements ResourceServer.
func (n *NoopServer) Create(context.Context, *CreateRequest) (*CreateResponse, error) {
	return nil, ErrNotImplementedYet
}

// Update implements ResourceServer.
func (n *NoopServer) Update(context.Context, *UpdateRequest) (*UpdateResponse, error) {
	return nil, ErrNotImplementedYet
}

// Delete implements ResourceServer.
func (n *NoopServer) Delete(context.Context, *DeleteRequest) (*DeleteResponse, error) {
	return nil, ErrNotImplementedYet
}

// List implements ResourceServer.
func (n *NoopServer) List(context.Context, *ListRequest) (*ListResponse, error) {
	return nil, ErrNotImplementedYet
}

// Watch implements ResourceServer.
func (n *NoopServer) Watch(*WatchRequest, ResourceStore_WatchServer) error {
	return ErrNotImplementedYet
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

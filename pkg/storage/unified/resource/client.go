package resource

import (
	"context"
	"errors"

	"github.com/fullstorydev/grpchan"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// ResourceClient implements all grpc services provided by the ResourceServer
type ResourceClient interface {
	ResourceStoreClient
	ResourceIndexClient
	DiagnosticsClient
}

// Internal implementation
type resourceClient struct {
	ResourceStoreClient
	ResourceIndexClient
	DiagnosticsClient
}

func NewResourceClient(channel *grpc.ClientConn) ResourceClient {
	cc := grpchan.InterceptClientConn(channel, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return &resourceClient{
		ResourceStoreClient: NewResourceStoreClient(cc),
		ResourceIndexClient: NewResourceIndexClient(cc),
		DiagnosticsClient:   NewDiagnosticsClient(cc),
	}
}

func NewLocalResourceClient(server ResourceServer) ResourceStoreClient {
	return &localResourceClient{server}
}

var _ ResourceClient = &localResourceClient{}

type localResourceClient struct {
	server ResourceServer
}

// Create implements ResourceClient.
func (c *localResourceClient) Create(ctx context.Context, in *CreateRequest, opts ...grpc.CallOption) (*CreateResponse, error) {
	return c.server.Create(ctx, in)
}

// Delete implements ResourceClient.
func (c *localResourceClient) Delete(ctx context.Context, in *DeleteRequest, opts ...grpc.CallOption) (*DeleteResponse, error) {
	return c.server.Delete(ctx, in)
}

// History implements ResourceClient.
func (c *localResourceClient) History(ctx context.Context, in *HistoryRequest, opts ...grpc.CallOption) (*HistoryResponse, error) {
	return c.server.History(ctx, in)
}

// IsHealthy implements ResourceClient.
func (c *localResourceClient) IsHealthy(ctx context.Context, in *HealthCheckRequest, opts ...grpc.CallOption) (*HealthCheckResponse, error) {
	return c.server.IsHealthy(ctx, in)
}

// List implements ResourceClient.
func (c *localResourceClient) List(ctx context.Context, in *ListRequest, opts ...grpc.CallOption) (*ListResponse, error) {
	return c.server.List(ctx, in)
}

// Origin implements ResourceClient.
func (c *localResourceClient) Origin(ctx context.Context, in *OriginRequest, opts ...grpc.CallOption) (*OriginResponse, error) {
	return c.server.Origin(ctx, in)
}

// Read implements ResourceClient.
func (c *localResourceClient) Read(ctx context.Context, in *ReadRequest, opts ...grpc.CallOption) (*ReadResponse, error) {
	return c.server.Read(ctx, in)
}

// Update implements ResourceClient.
func (c *localResourceClient) Update(ctx context.Context, in *UpdateRequest, opts ...grpc.CallOption) (*UpdateResponse, error) {
	return c.server.Update(ctx, in)
}

// Watch implements ResourceClient.
func (c *localResourceClient) Watch(ctx context.Context, in *WatchRequest, opts ...grpc.CallOption) (ResourceStore_WatchClient, error) {
	stream := &localWatchStream{
		ctx:    ctx,
		events: make(chan *WatchEvent),
	}
	err := c.server.Watch(in, stream)
	return stream, err
}

var (
	errLocalResourceClient = errors.New("unexpected request in local resource stream")
	errLocalStreamClosed   = errors.New("local stream is already closed")

	_ ResourceStore_WatchClient = &localWatchStream{}
	_ ResourceStore_WatchServer = &localWatchStream{}
)

type localWatchStream struct {
	ctx     context.Context
	events  chan *WatchEvent
	closed  bool
	trailer metadata.MD
}

// Send implements ResourceStore_WatchServer.
func (s *localWatchStream) Send(e *WatchEvent) error {
	if s.closed {
		return errLocalStreamClosed
	}
	s.events <- e
	return nil // check if the channel is OK?
}

// Recv implements ResourceStore_WatchClient.
func (s *localWatchStream) Recv() (*WatchEvent, error) {
	e := <-s.events
	return e, nil
}

// Context implements ResourceStore_WatchClient.
func (s *localWatchStream) Context() context.Context {
	return s.ctx
}

// CloseSend implements ResourceStore_WatchClient.
func (s *localWatchStream) CloseSend() error {
	s.closed = true
	return nil
}

// SendHeader implements ResourceStore_WatchServer.
func (s *localWatchStream) SendHeader(metadata.MD) error {
	return errLocalResourceClient
}

// SetHeader implements ResourceStore_WatchServer.
func (s *localWatchStream) SetHeader(metadata.MD) error {
	return errLocalResourceClient
}

// SetTrailer implements ResourceStore_WatchServer.
func (s *localWatchStream) SetTrailer(v metadata.MD) {
	s.trailer = v
}

// Header implements ResourceStore_WatchClient.
func (s *localWatchStream) Header() (metadata.MD, error) {
	return metadata.MD{}, nil
}

// RecvMsg implements ResourceStore_WatchClient.
func (s *localWatchStream) RecvMsg(m any) error {
	return errLocalResourceClient
}

// SendMsg implements ResourceStore_WatchClient.
func (s *localWatchStream) SendMsg(m any) error {
	return errLocalResourceClient
}

// Trailer implements ResourceStore_WatchClient.
func (s *localWatchStream) Trailer() metadata.MD {
	return s.trailer
}

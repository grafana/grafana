package resource

import (
	"context"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// EventualClient exposes the search capability of a ResourceClient that is
// supplied after construction via Set. It exists to break the wiring cycle
// between the authz access client and the resource client: the resource client
// depends on the access client, so consumers wired before it (like authz)
// cannot receive it directly. This mirrors apiserver's eventualRestConfigProvider.
//
// Search blocks until Set is called (or the context is cancelled).
type EventualClient struct {
	ready  chan struct{}
	client ResourceClient
}

// ProvideEventualClient creates an unresolved EventualClient. Set must be called
// once the real ResourceClient is available (see apiserver startup).
func ProvideEventualClient() *EventualClient {
	return &EventualClient{ready: make(chan struct{})}
}

// Set supplies the underlying client and unblocks pending/future calls. It must
// be called exactly once.
func (e *EventualClient) Set(client ResourceClient) {
	e.client = client
	close(e.ready)
}

// Search blocks until the underlying client is set, then delegates to it.
func (e *EventualClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	select {
	case <-e.ready:
		return e.client.Search(ctx, in, opts...)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

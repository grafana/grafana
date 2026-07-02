package grpcengine

import (
	"context"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

// Client implements engine.SearchEngine by calling a remote SearchEngine gRPC
// service. Callers must populate req.Authz for authorization scoping.
type Client struct {
	conn   grpc.ClientConnInterface
	client resourcepb.SearchEngineClient
}

func NewClient(conn grpc.ClientConnInterface) *Client {
	return &Client{conn: conn, client: resourcepb.NewSearchEngineClient(conn)}
}

func (c *Client) Index(ctx context.Context, req *resourcepb.IndexRequest) (*resourcepb.IndexResponse, error) {
	return c.client.Index(ctx, req)
}

func (c *Client) Search(ctx context.Context, req *resourcepb.SearchRequest) (*resourcepb.SearchResponse, error) {
	return c.client.Search(ctx, req)
}

func (c *Client) Stats(ctx context.Context, req *resourcepb.StatsRequest) (*resourcepb.StatsResponse, error) {
	return c.client.Stats(ctx, req)
}

func (c *Client) Refresh(ctx context.Context, req *resourcepb.RefreshRequest) (*resourcepb.RefreshResponse, error) {
	return c.client.Refresh(ctx, req)
}

func (c *Client) DeleteIndex(ctx context.Context, req *resourcepb.DeleteIndexRequest) (*resourcepb.DeleteIndexResponse, error) {
	return c.client.DeleteIndex(ctx, req)
}

func (c *Client) Health(ctx context.Context, req *resourcepb.HealthRequest) (*resourcepb.HealthResponse, error) {
	return c.client.Health(ctx, req)
}

var _ engine.SearchEngine = (*Client)(nil)

package tempo

import (
	"context"
	connect_go "github.com/bufbuild/connect-go"
	"github.com/grafana/grafana/pkg/tsdb/tempo/proto/gen"
	"strings"
)

type tempoServiceClient struct {
	search *connect_go.Client[tempopb.SearchRequest, tempopb.SearchResponse]
}

type TempoServiceClient interface {
	Search(ctx context.Context, req *connect_go.Request[tempopb.SearchRequest]) (*connect_go.ServerStreamForClient[tempopb.SearchResponse], error)
}

func NewQuerierServiceClient(httpClient connect_go.HTTPClient, baseURL string, opts ...connect_go.ClientOption) TempoServiceClient {
	baseURL = strings.TrimRight(baseURL, "/")
	return &tempoServiceClient{
		search: connect_go.NewClient[tempopb.SearchRequest, tempopb.SearchResponse](
			httpClient,
			baseURL+"/tempopb.StreamingQuerier/Search",
			opts...,
		),
	}
}

func (c *tempoServiceClient) Search(ctx context.Context, req *connect_go.Request[tempopb.SearchRequest]) (*connect_go.ServerStreamForClient[tempopb.SearchResponse], error) {
	return c.search.CallServerStream(ctx, req)
}

package resource

import (
	"context"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	grpc "google.golang.org/grpc"
)

func NewSearchClient(cfg *setting.Cfg, newClient ResourceIndexClient, legacyServer ResourceIndexClient) ResourceIndexClient {
	clientWrapper := &searchClient{
		mode:          cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode,
		unifiedClient: newClient,
		legacyServer:  legacyServer,
	}

	return clientWrapper
}

type searchClient struct {
	mode          rest.DualWriterMode
	unifiedClient ResourceIndexClient
	legacyServer  ResourceIndexClient
}

func (d *searchClient) Search(ctx context.Context, in *ResourceSearchRequest, opts ...grpc.CallOption) (*ResourceSearchResponse, error) {
	switch d.mode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return d.legacyServer.Search(ctx, in)
	default:
		return d.unifiedClient.Search(ctx, in)
	}
}

func (d *searchClient) GetStats(ctx context.Context, in *ResourceStatsRequest, opts ...grpc.CallOption) (*ResourceStatsResponse, error) {
	switch d.mode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return d.legacyServer.GetStats(ctx, in)
	default:
		return d.unifiedClient.GetStats(ctx, in)
	}
}

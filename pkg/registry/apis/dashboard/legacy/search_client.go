package legacy

import (
	"context"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	grpc "google.golang.org/grpc"
)

func NewSearchClient(cfg *setting.Cfg, newClient resource.ResourceIndexClient, legacyServer resource.ResourceIndexServer) resource.ResourceIndexClient {
	clientWrapper := &searchClient{
		mode:          cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode,
		unifiedClient: newClient,
		legacyServer:  legacyServer,
	}

	return clientWrapper
}

type searchClient struct {
	mode          rest.DualWriterMode
	unifiedClient resource.ResourceIndexClient
	legacyServer  resource.ResourceIndexServer
}

func (d *searchClient) Search(ctx context.Context, in *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	switch d.mode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return d.legacyServer.Search(ctx, in)
	default:
		return d.unifiedClient.Search(ctx, in)
	}
}

func (d *searchClient) GetStats(ctx context.Context, in *resource.ResourceStatsRequest, opts ...grpc.CallOption) (*resource.ResourceStatsResponse, error) {
	switch d.mode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return d.legacyServer.GetStats(ctx, in)
	default:
		return d.unifiedClient.GetStats(ctx, in)
	}
}

package resource

import (
	"context"
	"fmt"

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
	fmt.Println("yoyoyo hitting the thing alright")
	switch d.mode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		fmt.Println("hitting legacy")
		return d.legacyServer.Search(ctx, in)
	default:
		fmt.Println("hitting unified")
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

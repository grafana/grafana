package pluginproxy

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/aztokenprovider"
)

type azureAccessTokenProvider struct {
	ctx           context.Context
	tokenProvider aztokenprovider.AzureTokenProvider
}

func newAzureAccessTokenProvider(ctx context.Context, cfg *setting.Cfg, authParams *plugins.JwtTokenAuth) *azureAccessTokenProvider {
	return &azureAccessTokenProvider{
		ctx:           ctx,
		tokenProvider: aztokenprovider.NewAzureAccessTokenProvider(cfg, authParams),
	}
}

func (provider *azureAccessTokenProvider) GetAccessToken() (string, error) {
	return provider.tokenProvider.GetAccessToken(provider.ctx)
}

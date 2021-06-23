package pluginproxy

import (
	"context"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/tokenprovider"
)

type azureAccessTokenProvider struct {
	impl tokenprovider.AzureTokenProvider
}

func newAzureAccessTokenProvider(ctx context.Context, cfg *setting.Cfg, authParams *plugins.JwtTokenAuth) *azureAccessTokenProvider {
	return &azureAccessTokenProvider{
		impl: tokenprovider.NewAzureAccessTokenProvider(ctx, cfg, authParams),
	}
}

func (provider *azureAccessTokenProvider) GetAccessToken() (string, error) {
	return provider.impl.GetAccessToken()
}

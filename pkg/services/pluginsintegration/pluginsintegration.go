package pluginsintegration

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvidePluginsIntegrationSet(cfg *setting.Cfg,
	oAuthTokenService oauthtoken.OAuthTokenService) wire.ProviderSet {
	clientMiddlewares := []plugins.ClientMiddleware{
		clientmiddleware.NewForwardOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewForwardCookiesMiddleware(cfg),
	}

	return wire.NewSet(
		provideClientProvider(clientMiddlewares...),
		wire.Bind(new(plugins.Client), new(*client.Provider)),
	)
}

func provideClientProvider(middlewares ...plugins.ClientMiddleware) func(pCfg *config.Cfg,
	pluginRegistry registry.Service) (*client.Provider, error) {
	return func(pCfg *config.Cfg,
		pluginRegistry registry.Service) (*client.Provider, error) {
		c := client.ProvideService(pluginRegistry, pCfg)
		return client.NewProvider(c, middlewares...)
	}
}

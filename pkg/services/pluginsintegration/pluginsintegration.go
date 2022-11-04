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

// WireSet provides a wire.ProviderSet of plugin providers.
var WireSet = wire.NewSet(
	ProvideClientDecorator,
	wire.Bind(new(plugins.Client), new(*client.Decorator)),
)

func ProvideClientDecorator(cfg *setting.Cfg, pCfg *config.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService) (*client.Decorator, error) {
	c := client.ProvideService(pluginRegistry, pCfg)
	clientMiddlewares := []plugins.ClientMiddleware{
		clientmiddleware.NewForwardOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewForwardCookiesMiddleware(cfg),
	}

	return client.NewDecorator(c, clientMiddlewares...)
}

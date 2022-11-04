package pluginsintegration

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	processManager "github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	managerStore "github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
)

// WireSet provides a wire.ProviderSet of plugin providers.
var WireSet = wire.NewSet(
	config.ProvideConfig,
	managerStore.ProvideService,
	wire.Bind(new(plugins.Store), new(*managerStore.Service)),
	wire.Bind(new(plugins.RendererManager), new(*managerStore.Service)),
	wire.Bind(new(plugins.SecretsPluginManager), new(*managerStore.Service)),
	wire.Bind(new(plugins.StaticRouteResolver), new(*managerStore.Service)),
	ProvideClientDecorator,
	wire.Bind(new(plugins.Client), new(*client.Decorator)),
	processManager.ProvideService,
	wire.Bind(new(processManager.Service), new(*processManager.Manager)),
	coreplugin.ProvideCoreRegistry,
	loader.ProvideService,
	wire.Bind(new(loader.Service), new(*loader.Loader)),
	wire.Bind(new(plugins.ErrorResolver), new(*loader.Loader)),
	manager.ProvideInstaller,
	wire.Bind(new(plugins.Installer), new(*manager.PluginInstaller)),
)

func ProvideClientDecorator(cfg *setting.Cfg, pCfg *config.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService) (*client.Decorator, error) {
	return NewClientDecorator(cfg, pCfg, pluginRegistry, oAuthTokenService)
}

func NewClientDecorator(cfg *setting.Cfg, pCfg *config.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService) (*client.Decorator, error) {
	c := client.ProvideService(pluginRegistry, pCfg)
	clientMiddlewares := []plugins.ClientMiddleware{
		clientmiddleware.NewForwardOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewForwardCookiesMiddleware(cfg),
	}

	return client.NewDecorator(c, clientMiddlewares...)
}

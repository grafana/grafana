package pluginsintegration

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
)

// WireSet provides a wire.ProviderSet of plugin providers.
var WireSet = wire.NewSet(
	config.ProvideConfig,
	store.ProvideService,
	wire.Bind(new(plugins.Store), new(*store.Service)),
	wire.Bind(new(plugins.RendererManager), new(*store.Service)),
	wire.Bind(new(plugins.SecretsPluginManager), new(*store.Service)),
	wire.Bind(new(plugins.StaticRouteResolver), new(*store.Service)),
	ProvideClientDecorator,
	wire.Bind(new(plugins.Client), new(*client.Decorator)),
	process.ProvideService,
	wire.Bind(new(process.Service), new(*process.Manager)),
	coreplugin.ProvideCoreRegistry,
	loader.ProvideService,
	wire.Bind(new(loader.Service), new(*loader.Loader)),
	wire.Bind(new(plugins.ErrorResolver), new(*loader.Loader)),
	manager.ProvideInstaller,
	wire.Bind(new(plugins.Installer), new(*manager.PluginInstaller)),
	registry.ProvideService,
	wire.Bind(new(registry.Service), new(*registry.InMemory)),
	repo.ProvideService,
	wire.Bind(new(repo.Service), new(*repo.Manager)),
	plugincontext.ProvideService,
)

// WireExtensionSet provides a wire.ProviderSet of plugin providers that can be
// extended.
var WireExtensionSet = wire.NewSet(
	provider.ProvideService,
	wire.Bind(new(plugins.BackendFactoryProvider), new(*provider.Service)),
	signature.ProvideOSSAuthorizer,
	wire.Bind(new(plugins.PluginLoaderAuthorizer), new(*signature.UnsignedPluginAuthorizer)),
)

func ProvideClientDecorator(cfg *setting.Cfg, pCfg *config.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService) (*client.Decorator, error) {
	return NewClientDecorator(cfg, pCfg, pluginRegistry, oAuthTokenService)
}

func NewClientDecorator(cfg *setting.Cfg, pCfg *config.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService) (*client.Decorator, error) {
	c := client.ProvideService(pluginRegistry, pCfg, nil)
	middlewares := CreateMiddlewares(cfg, oAuthTokenService)

	return client.NewDecorator(c, middlewares...)
}

func CreateMiddlewares(cfg *setting.Cfg, oAuthTokenService oauthtoken.OAuthTokenService) []plugins.ClientMiddleware {
	skipCookiesNames := []string{cfg.LoginCookieName}
	middlewares := []plugins.ClientMiddleware{
		clientmiddleware.NewClearAuthHeadersMiddleware(),
		clientmiddleware.NewOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewCookiesMiddleware(skipCookiesNames),
	}

	return middlewares
}

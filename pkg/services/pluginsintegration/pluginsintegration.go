package pluginsintegration

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/plugins/pluginmod"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
)

// WireSet provides a wire.ProviderSet of plugin providers.
var WireSet = wire.NewSet(
	config.ProvideConfig,
	coreplugin.ProvideCoreRegistry,
	plugincontext.ProvideService,
	pluginscdn.ProvideService,

	//TODO remove (only here to support backendplugin_test.go)
	// <toRemove>
	wire.Bind(new(registry.Service), new(*registry.InMemory)),
	registry.ProvideService,
	ProvideClientDecorator,
	// </toRemove>

	wire.Bind(new(plugins.RendererManager), new(*pluginmod.PluginsModule)),
	wire.Bind(new(plugins.SecretsPluginManager), new(*pluginmod.PluginsModule)),
	wire.Bind(new(plugins.StaticRouteResolver), new(*pluginmod.PluginsModule)),
	wire.Bind(new(plugins.ErrorResolver), new(*pluginmod.PluginsModule)),
	wire.Bind(new(plugins.Client), new(*pluginmod.PluginsModule)),
	wire.Bind(new(plugins.Store), new(*pluginmod.PluginsModule)),
	wire.Bind(new(plugins.Installer), new(*pluginmod.PluginsModule)),
	pluginmod.ProvidePluginsModule,
	wire.Bind(new(sources.Resolver), new(*sources.Service)),
	sources.ProvideService,
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
	c := client.ProvideService(pluginRegistry, pCfg)
	middlewares := CreateMiddlewares(cfg, oAuthTokenService)

	return client.NewDecorator(c, middlewares...)
}

func CreateMiddlewares(cfg *setting.Cfg, oAuthTokenService oauthtoken.OAuthTokenService) []plugins.ClientMiddleware {
	skipCookiesNames := []string{cfg.LoginCookieName}
	middlewares := []plugins.ClientMiddleware{
		clientmiddleware.NewTracingHeaderMiddleware(),
		clientmiddleware.NewClearAuthHeadersMiddleware(),
		clientmiddleware.NewOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewCookiesMiddleware(skipCookiesNames),
	}

	if cfg.SendUserHeader {
		middlewares = append(middlewares, clientmiddleware.NewUserHeaderMiddleware())
	}

	middlewares = append(middlewares, clientmiddleware.NewHTTPClientMiddleware())

	return middlewares
}

package pluginsintegration

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/filestore"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/config"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
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
	pluginscdn.ProvideService,
	assetpath.ProvideService,
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
	licensing.ProvideLicensing,
	wire.Bind(new(plugins.Licensing), new(*licensing.Service)),
	wire.Bind(new(sources.Registry), new(*sources.Service)),
	sources.ProvideService,
	pluginSettings.ProvideService,
	wire.Bind(new(pluginsettings.Service), new(*pluginSettings.Service)),
	filestore.ProvideService,
	wire.Bind(new(plugins.FileStore), new(*filestore.Service)),
)

// WireExtensionSet provides a wire.ProviderSet of plugin providers that can be
// extended.
var WireExtensionSet = wire.NewSet(
	provider.ProvideService,
	wire.Bind(new(plugins.BackendFactoryProvider), new(*provider.Service)),
	signature.ProvideOSSAuthorizer,
	wire.Bind(new(plugins.PluginLoaderAuthorizer), new(*signature.UnsignedPluginAuthorizer)),
	wire.Bind(new(finder.Finder), new(*finder.Local)),
	finder.NewLocalFinder,
)

func ProvideClientDecorator(
	cfg *setting.Cfg, pCfg *pCfg.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService,
	tracer tracing.Tracer,
	cachingService caching.CachingService,
	features *featuremgmt.FeatureManager,
) (*client.Decorator, error) {
	return NewClientDecorator(cfg, pCfg, pluginRegistry, oAuthTokenService, tracer, cachingService, features)
}

func NewClientDecorator(
	cfg *setting.Cfg, pCfg *pCfg.Cfg,
	pluginRegistry registry.Service, oAuthTokenService oauthtoken.OAuthTokenService,
	tracer tracing.Tracer, cachingService caching.CachingService, features *featuremgmt.FeatureManager,
) (*client.Decorator, error) {
	c := client.ProvideService(pluginRegistry, pCfg)
	middlewares := CreateMiddlewares(cfg, oAuthTokenService, tracer, cachingService, features)

	return client.NewDecorator(c, middlewares...)
}

func CreateMiddlewares(cfg *setting.Cfg, oAuthTokenService oauthtoken.OAuthTokenService, tracer tracing.Tracer, cachingService caching.CachingService, features *featuremgmt.FeatureManager) []plugins.ClientMiddleware {
	skipCookiesNames := []string{cfg.LoginCookieName}
	middlewares := []plugins.ClientMiddleware{
		clientmiddleware.NewTracingMiddleware(tracer),
		clientmiddleware.NewTracingHeaderMiddleware(),
		clientmiddleware.NewClearAuthHeadersMiddleware(),
		clientmiddleware.NewOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewCookiesMiddleware(skipCookiesNames),
	}

	// Placing the new service implementation behind a feature flag until it is known to be stable
	if features.IsEnabled(featuremgmt.FlagUseCachingService) {
		middlewares = append(middlewares, clientmiddleware.NewCachingMiddleware(cachingService))
	}

	if cfg.SendUserHeader {
		middlewares = append(middlewares, clientmiddleware.NewUserHeaderMiddleware())
	}

	middlewares = append(middlewares, clientmiddleware.NewHTTPClientMiddleware())

	return middlewares
}

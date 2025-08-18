package pluginsintegration

import (
	"github.com/google/wire"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/filestore"
	pluginLoader "github.com/grafana/grafana/pkg/plugins/manager/loader"
	pAngularInspector "github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	pluginassets2 "github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/advisor"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetectorsprovider"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularinspector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keyretriever/dynamic"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keystore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/loader"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginexternal"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/renderer"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/serviceregistration"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

// WireSet provides a wire.ProviderSet of plugin providers.
var WireSet = wire.NewSet(
	pluginconfig.ProvidePluginManagementConfig,
	pluginconfig.ProvidePluginInstanceConfig,
	pluginconfig.NewEnvVarsProvider,
	wire.Bind(new(envvars.Provider), new(*pluginconfig.EnvVarsProvider)),
	pluginconfig.NewRequestConfigProvider,
	wire.Bind(new(pluginconfig.PluginRequestConfigProvider), new(*pluginconfig.RequestConfigProvider)),
	pluginstore.ProvideService,
	wire.Bind(new(pluginstore.Store), new(*pluginstore.Service)),
	wire.Bind(new(plugins.StaticRouteResolver), new(*pluginstore.Service)),
	process.ProvideService,
	wire.Bind(new(process.Manager), new(*process.Service)),
	coreplugin.ProvideCoreRegistry,
	pluginscdn.ProvideService,
	assetpath.ProvideService,

	pipeline.ProvideDiscoveryStage,
	wire.Bind(new(discovery.Discoverer), new(*discovery.Discovery)),
	pipeline.ProvideBootstrapStage,
	wire.Bind(new(bootstrap.Bootstrapper), new(*bootstrap.Bootstrap)),
	pipeline.ProvideInitializationStage,
	wire.Bind(new(initialization.Initializer), new(*initialization.Initialize)),
	pipeline.ProvideTerminationStage,
	wire.Bind(new(termination.Terminator), new(*termination.Terminate)),
	pipeline.ProvideValidationStage,
	wire.Bind(new(validation.Validator), new(*validation.Validate)),

	angularpatternsstore.ProvideService,
	angulardetectorsprovider.ProvideDynamic,
	angularinspector.ProvideService,
	wire.Bind(new(pAngularInspector.Inspector), new(*angularinspector.Service)),

	signature.ProvideValidatorService,
	wire.Bind(new(signature.Validator), new(*signature.Validation)),
	loader.ProvideService,
	wire.Bind(new(pluginLoader.Service), new(*loader.Loader)),
	pluginerrs.ProvideErrorTracker,
	wire.Bind(new(pluginerrs.ErrorTracker), new(*pluginerrs.ErrorRegistry)),
	pluginerrs.ProvideStore,
	wire.Bind(new(plugins.ErrorResolver), new(*pluginerrs.Store)),
	registry.ProvideService,
	wire.Bind(new(registry.Service), new(*registry.InMemory)),
	repo.ProvideService,
	wire.Bind(new(repo.Service), new(*repo.Manager)),
	licensing.ProvideLicensing,
	wire.Bind(new(plugins.Licensing), new(*licensing.Service)),
	pluginSettings.ProvideService,
	wire.Bind(new(pluginsettings.Service), new(*pluginSettings.Service)),
	filestore.ProvideService,
	wire.Bind(new(plugins.FileStore), new(*filestore.Service)),
	wire.Bind(new(plugins.SignatureCalculator), new(*signature.Signature)),
	signature.ProvideService,
	wire.Bind(new(plugins.KeyStore), new(*keystore.Service)),
	keystore.ProvideService,
	wire.Bind(new(plugins.KeyRetriever), new(*keyretriever.Service)),
	keyretriever.ProvideService,
	dynamic.ProvideService,
	serviceregistration.ProvideService,
	wire.Bind(new(auth.ExternalServiceRegistry), new(*serviceregistration.Service)),
	renderer.ProvideService,
	wire.Bind(new(rendering.PluginManager), new(*renderer.Manager)),
	pluginexternal.ProvideService,
	plugincontext.ProvideBaseService,
	wire.Bind(new(plugincontext.BasePluginContextProvider), new(*plugincontext.BaseProvider)),
	plugininstaller.ProvideService,
	pluginassets.ProvideService,
	pluginchecker.ProvidePreinstall,
	wire.Bind(new(pluginchecker.Preinstall), new(*pluginchecker.PreinstallImpl)),
	advisor.ProvideService,
	wire.Bind(new(advisor.AdvisorStats), new(*advisor.Service)),
	pluginchecker.ProvideService,
	wire.Bind(new(pluginchecker.PluginUpdateChecker), new(*pluginchecker.Service)),
)

// WireExtensionSet provides a wire.ProviderSet of plugin providers that can be
// extended.
var WireExtensionSet = wire.NewSet(
	provider.ProvideService,
	wire.Bind(new(plugins.BackendFactoryProvider), new(*provider.Service)),
	signature.ProvideOSSAuthorizer,
	wire.Bind(new(plugins.PluginLoaderAuthorizer), new(*signature.UnsignedPluginAuthorizer)),
	ProvideClientWithMiddlewares,
	wire.Bind(new(plugins.Client), new(*backend.MiddlewareHandler)),
	managedplugins.NewNoop,
	wire.Bind(new(managedplugins.Manager), new(*managedplugins.Noop)),
	provisionedplugins.NewNoop,
	wire.Bind(new(provisionedplugins.Manager), new(*provisionedplugins.Noop)),
	sources.ProvideService,
	wire.Bind(new(sources.Registry), new(*sources.Service)),
	checkregistry.ProvideService,
	wire.Bind(new(checkregistry.CheckService), new(*checkregistry.Service)),
	pluginassets2.ProvideService,
	wire.Bind(new(pluginassets2.Provider), new(*pluginassets2.LocalProvider)),
)

func ProvideClientWithMiddlewares(
	cfg *setting.Cfg,
	pluginRegistry registry.Service,
	oAuthTokenService oauthtoken.OAuthTokenService,
	tracer tracing.Tracer,
	cachingService caching.CachingService,
	features featuremgmt.FeatureToggles,
	promRegisterer prometheus.Registerer,
) (*backend.MiddlewareHandler, error) {
	return NewMiddlewareHandler(cfg, pluginRegistry, oAuthTokenService, tracer, cachingService, features, promRegisterer, pluginRegistry)
}

func NewMiddlewareHandler(
	cfg *setting.Cfg,
	pluginRegistry registry.Service, oAuthTokenService oauthtoken.OAuthTokenService,
	tracer tracing.Tracer, cachingService caching.CachingService, features featuremgmt.FeatureToggles,
	promRegisterer prometheus.Registerer, registry registry.Service,
) (*backend.MiddlewareHandler, error) {
	c := client.ProvideService(pluginRegistry)
	middlewares := CreateMiddlewares(cfg, oAuthTokenService, tracer, cachingService, features, promRegisterer, registry)
	return backend.HandlerFromMiddlewares(c, middlewares...)
}

func CreateMiddlewares(cfg *setting.Cfg, oAuthTokenService oauthtoken.OAuthTokenService, tracer tracing.Tracer, cachingService caching.CachingService, features featuremgmt.FeatureToggles, promRegisterer prometheus.Registerer, registry registry.Service) []backend.HandlerMiddleware {
	middlewares := []backend.HandlerMiddleware{
		clientmiddleware.NewTracingMiddleware(tracer),
		clientmiddleware.NewMetricsMiddleware(promRegisterer, registry),
		clientmiddleware.NewContextualLoggerMiddleware(),
	}

	if cfg.PluginLogBackendRequests {
		middlewares = append(middlewares, clientmiddleware.NewLoggerMiddleware(log.New("plugin.instrumentation"), registry))
	}

	skipCookiesNames := []string{cfg.LoginCookieName}

	middlewares = append(middlewares,
		clientmiddleware.NewTracingHeaderMiddleware(),
		clientmiddleware.NewClearAuthHeadersMiddleware(),
		clientmiddleware.NewOAuthTokenMiddleware(oAuthTokenService),
		clientmiddleware.NewCookiesMiddleware(skipCookiesNames),
		clientmiddleware.NewCachingMiddlewareWithFeatureManager(cachingService, features),
		clientmiddleware.NewForwardIDMiddleware(),
		clientmiddleware.NewUseAlertHeadersMiddleware(),
	)

	if cfg.SendUserHeader {
		middlewares = append(middlewares, clientmiddleware.NewUserHeaderMiddleware())
	}

	if cfg.IPRangeACEnabled {
		middlewares = append(middlewares, clientmiddleware.NewHostedGrafanaACHeaderMiddleware(cfg))
	}

	middlewares = append(middlewares, clientmiddleware.NewHTTPClientMiddleware())

	// ErrorSourceMiddleware should be at the very bottom, or any middlewares below it won't see the
	// correct error source in their context.Context
	middlewares = append(middlewares, backend.NewErrorSourceMiddleware())

	return middlewares
}

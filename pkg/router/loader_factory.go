package router

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/infra/tracing"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ProvideRoutesLoader serves local plugins, or no groups without plugin
// sources, and the core apps from the installers when the router registers
// them. It never loads the cloud sources: the standalone router tries
// ProvideCloudRoutesLoader first, and calls ProvideStandaloneRoutesLoader only
// when [cloud_router] configures none, and Grafana itself never polls them.
func ProvideRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies, apps []appsdk.AppInstaller) (RoutesLoader, error) {
	loader, err := provideBaseRoutesLoader(cfg, deps)
	if err != nil {
		return nil, err
	}
	if !standaloneRouter(cfg) && registerCoreAPIs() {
		if !MiddlewareEnabled(cfg, deps.Features) {
			return nil, fmt.Errorf("%s requires %s", featuremgmt.FlagRouterRegisterCoreAPIs, featuremgmt.FlagGrafanaUseRouterMiddleware)
		}
		coreApps, err := coreAppsFromInstallers(context.Background(), apps, cfg, deps.PluginAuth)
		if err != nil {
			return nil, err
		}
		loader = newCoreAppsLoader(loader, deps.PluginDependencies, coreApps)
	}
	// In grafana cloud, each stack *may* aggregate a multi-tenant upstream service
	if MiddlewareEnabled(cfg, deps.Features) {
		remote, err := newRemoteServicesLoader(context.Background(), cfg, loader)
		if err != nil {
			// A bad remote services config must not stop Grafana from starting;
			// the base groups keep serving without the remote ones.
			logging.DefaultLogger.Warn("router: remote services not mounted", "err", err)
			return loader, nil
		}
		return remote, nil
	}
	return loader, nil
}

// ProvideStandaloneRoutesLoader is ProvideRoutesLoader for the standalone
// router, which has no installers of its own to run. Taking none keeps Wire
// from constructing every installer (and their storage, NATS and so on) only
// to discard them.
func ProvideStandaloneRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	return provideBaseRoutesLoader(cfg, deps)
}

func provideBaseRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	dev, err := newDevTargets(cfg, deps.PluginDependencies)
	if err != nil {
		return nil, err
	}
	if deps.PluginSources != nil || dev != nil {
		if MiddlewareEnabled(cfg, deps.Features) {
			// When running in ST grafana as middleware, declare plugin roles and resolve settings storage defaults
			if deps.PluginSources != nil {
				if err := initLocalPlugins(context.Background(), deps); err != nil {
					return nil, err
				}
			}
			dev.declareRoles(context.Background(), deps.ACService)
		}
		return &PluginLoader{deps: deps, settings: settingsEnabled(cfg), dev: dev}, nil
	}

	return noRoutesLoader{}, nil
}

// noRoutesLoader serves no groups, for a router without plugin sources.
type noRoutesLoader struct{}

func (noRoutesLoader) Load(context.Context) ([]Backend, error) { return nil, nil }

func (noRoutesLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

// ProvideCloudRoutesLoader builds the cloud routes loader from the router
// module's clients, without ProvideRoutesLoader's dependencies: those open the
// SQL database and run migrations. Like NewCloudRoutesLoader, it
// returns (nil, nil) when [cloud_router] configures no source.
//
// The edition-specific Wire graph supplies the remote legacy settings provider.
// Settings routes require app_settings_enabled; this constructs no local SQL services.
func ProvideCloudRoutesLoader(
	cfg *setting.Cfg,
	clients RoutesLoaderClients,
	settings CloudSettingsDependencies,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	reg prometheus.Registerer,
) (RoutesLoader, error) {
	decrypter, err := remoteDecrypter(cfg, tracer)
	if err != nil {
		return nil, err
	}
	var builderMetrics *builder.BuilderMetrics
	if cloudAppSettingsEnabled(cfg) {
		if clients.DualWrite == nil {
			clients.DualWrite, err = dualwrite.ProvideService(cfg, dualwrite.NewFakeMigrator(), dualwrite.NewConfigBasedMigrationStatusReader(cfg), reg)
			if err != nil {
				return nil, err
			}
		}
		builderMetrics = builder.ProvideBuilderMetrics(reg)
	}
	return NewCloudRoutesLoader(cfg, PluginDependencies{
		DualWrite:       clients.DualWrite,
		BuilderMetrics:  builderMetrics,
		ContextProvider: cloudPluginContext{},
		AccessControl:   cloudSettingsAccessControl{clients.LegacyAccess},
		Settings: SettingsDependencies{
			LegacyStore:         settings.LegacyStore,
			ReadOnly:            true,
			AccessChecker:       cloudSettingsAccessChecker(clients.LegacyAccess),
			NamespaceAuthorizer: authorizer.AuthorizerFunc(cloudSettingsNamespaceAuthorizer),
			Middleware: append([]backend.HandlerMiddleware{
				clientmiddleware.NewTracingHeaderMiddleware(),
				clientmiddleware.NewForwardIDMiddleware(nil),
			}, settings.Middleware...),
		},
		SecureValues:       clients.SecureValues,
		MetricsRegister:    reg,
		RESTConfigProvider: clients.RESTConfigProvider,
		Unified:            clients.Resource,
		AccessClient:       clients.Access,
		Decrypter:          decrypter,
		TokenExchanger:     newClientV3TokenExchanger(cfg),
		Tracer:             tracer,
		Features:           features,
		Cfg:                cfg,
	})
}

// CloudSettingsDependencies supplies edition-specific storage and plugin credentials.
// ST and MT use the same settings and subresource handlers.
type CloudSettingsDependencies struct {
	LegacyStore LegacySettingsStoreProvider
	Middleware  []backend.HandlerMiddleware
}

// remoteDecrypter returns the secrets manager's gRPC client, or nil when it is
// disabled: the in-process decrypter reads secret metadata from the SQL
// database. A nil decrypter fails only the requests that read secure values.
func remoteDecrypter(cfg *setting.Cfg, tracer tracing.Tracer) (decrypt.DecryptService, error) {
	if !cfg.SecretsManagement.GrpcClientEnable {
		return nil, nil
	}
	return secretdecrypt.ProvideDecryptService(cfg, tracer, nil)
}

// RoutesLoaderClients groups clients that are constructed by the router module
// before the remaining routes loader dependencies are initialized.
type RoutesLoaderClients struct {
	RESTConfigProvider restcfg.RestConfigProvider
	Resource           resource.ResourceClient
	Access             types.AccessClient
	LegacyAccess       legacyclient.LegacyAccessClient
	DualWrite          dualwrite.Service
	SecureValues       secret.InlineSecureValueSupport
}

// MiddlewareEnabled reports whether the router serves API groups inside a
// single-tenant Grafana, ahead of the embedded API server. App plugin settings
// are only served by the router, so enabling them enables it too. The
// standalone router has no embedded API server to stand in front of, so it is
// never middleware, whatever the flags say: otherwise a flag that also reaches
// its deployment would drop its cloud sources.
func MiddlewareEnabled(cfg *setting.Cfg, features featuremgmt.FeatureToggles) bool {
	if standaloneRouter(cfg) {
		return false
	}
	return (features != nil && features.IsEnabledGlobally(featuremgmt.FlagGrafanaUseRouterMiddleware)) || settingsEnabled(cfg) //nolint:staticcheck
}

// settingsEnabled reports whether the router serves app plugin settings. It is
// read once, at startup, like MiddlewareEnabled, which it turns on: settings
// served without middleware would never be reached, and middleware without
// settings would take over plugin groups without their settings.
//
// The flag is evaluated through OpenFeature rather than IsEnabledGlobally,
// which only sees [feature_toggles]: a remote provider may be the only place
// it's enabled.
func settingsEnabled(cfg *setting.Cfg) bool {
	if standaloneRouter(cfg) {
		return false
	}
	ctx := context.Background()
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagApppluginsRegisterAPIServer, false, openfeature.TransactionContext(ctx))
}

// standaloneRouter reports whether this process runs the router target. Its
// local loader has no SQL settings store; cloud settings have a separate gate.
func standaloneRouter(cfg *setting.Cfg) bool {
	return cfg != nil && slices.Contains(cfg.Target, "router")
}

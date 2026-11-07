package router

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ProvideRoutesLoader serves local plugins, or no groups without plugin
// sources. It never loads the cloud sources: the
// standalone router tries ProvideCloudRoutesLoader first, and calls this only
// when [cloud_router] configures none, and Grafana itself never polls them.
func ProvideRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	// The embedded API server stops serving these groups with the toggle, so a
	// router that cannot serve them leaves them unserved.
	if routeCoreApps() && !standaloneRouter(cfg) && !middlewareEnabled(cfg, deps.Features) {
		return nil, fmt.Errorf("%s requires %s", featuremgmt.FlagGrafanaRouteCoreApps, featuremgmt.FlagGrafanaUseRouterMiddleware)
	}
	loader, err := provideBaseRoutesLoader(cfg, deps)
	if err != nil {
		return nil, err
	}
	if middlewareEnabled(cfg, deps.Features) {
		apps, err := builtinCoreApps(cfg, deps.PluginAuth)
		if err != nil {
			return nil, err
		}
		loader = newCoreAppsLoader(loader, deps.PluginDependencies, apps)
	}
	return loader, nil
}

func provideBaseRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	dev, err := newDevTargets(cfg, deps.PluginDependencies)
	if err != nil {
		return nil, err
	}
	if deps.PluginSources != nil || dev != nil {
		if middlewareEnabled(cfg, deps.Features) {
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
// Managed plugins get no plugin store, plugin settings, legacy access control
// or dual writer (see pluginManifestsTarget), so the builder metrics, which
// only the dual writer records, are not registered either.
func ProvideCloudRoutesLoader(
	cfg *setting.Cfg,
	clients RoutesLoaderClients,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	reg prometheus.Registerer,
) (RoutesLoader, error) {
	decrypter, err := remoteDecrypter(cfg, tracer)
	if err != nil {
		return nil, err
	}
	return NewCloudRoutesLoader(cfg, PluginDependencies{
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
	DualWrite          dualwrite.Service
	SecureValues       secret.InlineSecureValueSupport
}

// middlewareEnabled reports whether the router serves API groups inside a
// single-tenant Grafana, ahead of the embedded API server. App plugin settings
// are only served by the router, so enabling them enables it too. The
// standalone router has no embedded API server to stand in front of, so it is
// never middleware, whatever the flags say: otherwise a flag that also reaches
// its deployment would drop its cloud sources.
func middlewareEnabled(cfg *setting.Cfg, features featuremgmt.FeatureToggles) bool {
	if standaloneRouter(cfg) {
		return false
	}
	return (features != nil && features.IsEnabledGlobally(featuremgmt.FlagGrafanaUseRouterMiddleware)) || settingsEnabled(cfg) //nolint:staticcheck
}

// settingsEnabled reports whether the router serves app plugin settings. It is
// read once, at startup, like middlewareEnabled, which it turns on: settings
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

// standaloneRouter reports whether this process runs the router target, which
// serves no app plugin settings: they need the SQL settings store and dual
// writer that only Grafana itself provides.
func standaloneRouter(cfg *setting.Cfg) bool {
	return cfg != nil && slices.Contains(cfg.Target, "router")
}

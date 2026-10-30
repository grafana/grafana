package router

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	pluginslog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

func provideTestCloudRoutesLoader(cfg *setting.Cfg, reg prometheus.Registerer) (RoutesLoader, error) {
	return ProvideCloudRoutesLoader(cfg, RoutesLoaderClients{}, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), reg)
}

func TestProvideCloudRoutesLoader_NotConfigured(t *testing.T) {
	reg := prometheus.NewRegistry()
	loader, err := provideTestCloudRoutesLoader(setting.NewCfg(), reg)
	require.NoError(t, err)
	require.Nil(t, loader)

	// The router module then builds ProvideRoutesLoader's dependencies, which
	// register the builder metrics on the same registerer.
	require.NotPanics(t, func() { builder.ProvideBuilderMetrics(reg) })
}

func TestProvideCloudRoutesLoader_Decrypter(t *testing.T) {
	newCfg := func(t *testing.T) *setting.Cfg {
		cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": "https://plugins.invalid/plugins"})
		cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
		return cfg
	}
	pluginsTargetDeps := func(t *testing.T, cfg *setting.Cfg) PluginDependencies {
		loader, err := provideTestCloudRoutesLoader(cfg, prometheus.NewRegistry())
		require.NoError(t, err)
		cloud, ok := loader.(*cloudLoader)
		require.True(t, ok)
		require.NotNil(t, pluginManifestsTargetOf(cloud, sourcePlugins))
		return pluginManifestsTargetOf(cloud, sourcePlugins).deps
	}

	t.Run("secrets manager gRPC client", func(t *testing.T) {
		cfg := newCfg(t)
		cfg.SecretsManagement.GrpcClientEnable = true
		cfg.SecretsManagement.GrpcServerAddress = "127.0.0.1:10000"
		section, err := cfg.Raw.NewSection("grpc_client_authentication")
		require.NoError(t, err)
		_, err = section.NewKey("token", "tok")
		require.NoError(t, err)
		_, err = section.NewKey("token_exchange_url", "https://exchange.invalid")
		require.NoError(t, err)

		require.NotNil(t, pluginsTargetDeps(t, cfg).Decrypter)
	})

	t.Run("in-process secrets manager", func(t *testing.T) {
		require.Nil(t, pluginsTargetDeps(t, newCfg(t)).Decrypter)
	})

	t.Run("invalid secrets manager gRPC client", func(t *testing.T) {
		cfg := newCfg(t)
		cfg.SecretsManagement.GrpcClientEnable = true

		_, err := provideTestCloudRoutesLoader(cfg, prometheus.NewRegistry())
		require.ErrorContains(t, err, "grpc_server_address is required")
	})
}

// ProvideRoutesLoader never loads the cloud sources: the standalone router
// builds them with ProvideCloudRoutesLoader, and Grafana itself never polls
// them, in middleware mode or not.
func TestProvideRoutesLoader_NeverLoadsCloudSources(t *testing.T) {
	for name, features := range map[string]featuremgmt.FeatureToggles{
		"grafana":    featuremgmt.WithFeatures(),
		"middleware": featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), //nolint:staticcheck
	} {
		for key, value := range map[string]string{
			"st_discovery_url": "https://discovery.example.com",
			"plugins_url":      "https://plugins.invalid/plugins",
			"core_url":         "https://core.invalid/plugins",
		} {
			t.Run(name+"/"+key, func(t *testing.T) {
				deps := PluginLoaderDependencies{PluginDependencies: PluginDependencies{Features: features}}
				loader, err := ProvideRoutesLoader(cfgWithCloudRouterSection(t, map[string]string{key: value}), deps)
				require.NoError(t, err)
				require.IsType(t, noRoutesLoader{}, loader)
			})
		}
	}
}

// The standalone router builds the cloud loader whatever the middleware flag
// says, since it is never middleware.
func TestProvideCloudRoutesLoader_StandaloneIgnoresMiddlewareFlag(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": "https://plugins.invalid/plugins"})
	cfg.Target = []string{"router"}
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware) //nolint:staticcheck
	loader, err := ProvideCloudRoutesLoader(cfg, RoutesLoaderClients{}, tracing.InitializeTracerForTest(), features, prometheus.NewRegistry())
	require.NoError(t, err)
	require.IsType(t, &cloudLoader{}, loader)
	require.False(t, middlewareEnabled(cfg, features))
}

// clientV3Backend is a plugin process that serves a v3 client.
type clientV3Backend struct {
	backendplugin.Plugin
	client appclientv3.Client
}

func (clientV3Backend) IsDecommissioned() bool { return false }

func (b clientV3Backend) ClientV3(context.Context) (appclientv3.Client, bool) { return b.client, true }

// The router module's graph has no background service registry, so its local
// loader runs the plugin store. Without it, lookups would wait for a store that
// never starts.
func TestProvideRoutesLoaderRunsRouterModulePluginStore(t *testing.T) {
	tracer := tracing.InitializeTracerForTest()
	synctest.Test(t, func(t *testing.T) {
		client := &stubPluginClientV3{}
		plugin := &plugins.Plugin{JSONData: plugins.JSONData{ID: "store-app", Type: plugins.TypeApp}}
		plugin.RegisterClient(clientV3Backend{client: client})
		plugin.SetLogger(pluginslog.NewTestLogger())
		registry := pluginfakes.NewFakePluginRegistry()
		sources := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
			return []plugins.PluginSource{&pluginfakes.FakePluginSource{}}
		}}
		unloaded := false
		store := pluginstore.New(registry, &pluginfakes.FakeLoader{
			LoadFunc: func(ctx context.Context, _ plugins.PluginSource) ([]*plugins.Plugin, error) {
				return []*plugins.Plugin{plugin}, registry.Add(ctx, plugin)
			},
			UnloadFunc: func(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
				unloaded = true
				return p, nil
			},
		}, sources)

		cfg := setting.NewCfg()
		cfg.Target = []string{"router"}
		features := featuremgmt.WithFeatures()
		deps := ProvidePluginLoaderDependenciesWithClients(nil, nil, store, sources, nil, nil, nil, nil,
			tracer, features, cfg, prometheus.NewRegistry(), nil, RoutesLoaderClients{}, nil)
		loader, err := ProvideRoutesLoader(cfg, deps)
		require.NoError(t, err)
		svc, err := ProvideService(cfg, features, loader, prometheus.NewRegistry(), NewGrafanaRouter(nil, nil))
		require.NoError(t, err)

		require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
		require.Equal(t, services.Running, store.State())

		ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
		defer cancel()
		_, ok := store.Plugin(ctx, plugin.ID)
		require.True(t, ok)
		got, ok := deps.ClientV3Loader.ClientV3(ctx, plugin.ID)
		require.True(t, ok)
		require.Same(t, client, got)

		require.NoError(t, services.StopAndAwaitTerminated(t.Context(), svc))
		require.Equal(t, services.Terminated, store.State())
		require.True(t, unloaded, "stopping the router stops the store's plugins")
	})
}

// Grafana runs its plugin store as a background service, so the loader it
// builds must not start the store again.
func TestProvideRoutesLoaderLeavesGrafanaPluginStore(t *testing.T) {
	store := pluginstore.New(pluginfakes.NewFakePluginRegistry(), &pluginfakes.FakeLoader{}, &pluginfakes.FakeSourceRegistry{})
	cfg := setting.NewCfg()
	deps := ProvidePluginLoaderDependencies(nil, nil, store, &pluginfakes.FakeSourceRegistry{}, nil, nil, nil, nil, nil, nil,
		tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), cfg, nil, nil, prometheus.NewRegistry(), nil, nil, nil)
	loader, err := ProvideRoutesLoader(cfg, deps)
	require.NoError(t, err)
	require.IsType(t, &PluginLoader{}, loader)
	_, hasLifecycle := loader.(services.Service)
	require.False(t, hasLifecycle)
}

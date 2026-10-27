package router

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
		require.NotNil(t, pluginManifestsTargetOf(cloud, sourcePluginsURL))
		return pluginManifestsTargetOf(cloud, sourcePluginsURL).deps
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

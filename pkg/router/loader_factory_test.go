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
		require.NotNil(t, cloud.pluginsTarget)
		return cloud.pluginsTarget.deps
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

package router

import (
	"context"

	"github.com/grafana/authlib/types"
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

// ProvideRoutesLoader prefers configured cloud routes (appmanifest apiserver,
// the two fixed aggregate targets, and/or plugins_url -- see
// ProvideCloudRoutesLoaderFactory), then local plugins. Dummy groups let the
// router run when none of those sources are available.
func ProvideRoutesLoader(cfg *setting.Cfg, deps PluginLoaderDependencies) (RoutesLoader, error) {
	if cloud, err := ProvideCloudRoutesLoaderFactory(cfg, deps.PluginDependencies); err != nil || cloud != nil {
		return cloud, err
	}

	// Plugin sources
	if deps.PluginSources != nil {
		//nolint:staticcheck
		middleware := deps.Features != nil && deps.Features.IsEnabledGlobally(featuremgmt.FlagGrafanaUseRouterMiddleware) //nolint:staticcheck
		if middleware {
			// When running in ST grafana as middleware, declare plugin roles and resolve settings storage defaults
			if err := initLocalPlugins(context.Background(), deps); err != nil {
				return nil, err
			}
		}
		return &PluginLoader{deps: deps}, nil
	}

	return dummyRoutesLoader{groups: []string{
		"dummy-backend-1.ext.grafana.app",
		"dummy-backend-2.ext.grafana.app",
	}}, nil
}

// ProvideCloudRoutesLoader builds the cloud routes loader from the router
// module's clients, without ProvideRoutesLoader's dependencies: those open the
// SQL database and run migrations. Like ProvideCloudRoutesLoaderFactory, it
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
	return ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{
		SecureValues:       clients.SecureValues,
		MetricsRegister:    reg,
		RESTConfigProvider: clients.RESTConfigProvider,
		Unified:            clients.Resource,
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

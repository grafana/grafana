package router

import (
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ProvideRoutesLoader prefers configured cloud routes, then local plugins.
// Dummy groups let the router run when neither source is available.
func ProvideRoutesLoader(
	pluginClient plugins.Client,
	contextProvider appplugin.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	acService accesscontrol.Service,
	accessControl accesscontrol.AccessControl,
	unified resource.ResourceClient,
	accessClient types.AccessClient,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	dualWrite dualwrite.Service,
	secureValues secret.InlineSecureValueSupport,
	reg prometheus.Registerer,
	builderMetrics *builder.BuilderMetrics,
) (RoutesLoader, error) {
	if cloud, err := ProvideCloudRoutesLoaderFactory(cfg); err != nil {
		return nil, err
	} else if cloud != nil {
		return cloud, nil
	}

	// Plugin sources
	if pluginSources != nil {
		return newPluginLoader(pluginClient, contextProvider, clientV3Loader, pluginSources, pluginSettings,
			acService, accessControl, unified, accessClient, decrypter, tracer, features, cfg, dualWrite, secureValues, reg, builderMetrics)
	}

	return dummyRoutesLoader{groups: []string{
		"dummy-backend-1.ext.grafana.app",
		"dummy-backend-2.ext.grafana.app",
	}}, nil
}

// RoutesLoaderClients groups clients that are constructed by the router module
// before the remaining routes loader dependencies are initialized.
type RoutesLoaderClients struct {
	Resource     resource.ResourceClient
	Access       types.AccessClient
	DualWrite    dualwrite.Service
	SecureValues secret.InlineSecureValueSupport
}

func ProvideRoutesLoaderWithClients(
	pluginClient plugins.Client,
	contextProvider appplugin.PluginContextWrapper,
	clientV3Loader v3.ClientV3Loader,
	pluginSources sources.Registry,
	pluginSettings pluginsettings.Service,
	acService accesscontrol.Service,
	accessControl accesscontrol.AccessControl,
	decrypter decrypt.DecryptService,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	reg prometheus.Registerer,
	builderMetrics *builder.BuilderMetrics,
	clients RoutesLoaderClients,
) (RoutesLoader, error) {
	return ProvideRoutesLoader(
		pluginClient,
		contextProvider,
		clientV3Loader,
		pluginSources,
		pluginSettings,
		acService,
		accessControl,
		clients.Resource,
		clients.Access,
		decrypter,
		tracer,
		features,
		cfg,
		clients.DualWrite,
		clients.SecureValues,
		reg,
		builderMetrics,
	)
}

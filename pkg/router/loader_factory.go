package router

import (
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ProvideRoutesLoader wires the cloud-router RoutesLoader ahead of the dummy
// one: when [cloud_router].apiserver_url is configured, that loader wins;
// otherwise this falls back to two dummy API groups for exercising the OSS
// router target end to end. Plugin manifests will replace the dummy backends
// in a later iteration.
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
) (RoutesLoader, error) {
	if cloud, err := ProvideCloudRoutesLoaderFactory(cfg); err != nil {
		return nil, err
	} else if cloud != nil {
		return cloud, nil
	}

	return dummyRoutesLoader{groups: []string{
		"dummy-backend-1.ext.grafana.app",
		"dummy-backend-2.ext.grafana.app",
	}}, nil
}

// RoutesLoaderClients groups clients that are constructed by the router module
// before the remaining routes loader dependencies are initialized.
type RoutesLoaderClients struct {
	Resource resource.ResourceClient
	Access   types.AccessClient
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
	)
}

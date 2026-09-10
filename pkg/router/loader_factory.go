package router

import (
	"context"
	"fmt"
	"log/slog"

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

// ProvideRoutesLoader provides the first OSS loader implementation.
// Plugin manifests will be loaded here in a later iteration.
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
) RoutesLoader {
	slog.Debug("Providing empty routes loader",
		"pluginClient", fmt.Sprintf("%T", pluginClient),
		"contextProvider", fmt.Sprintf("%T", contextProvider),
		"clientV3Loader", fmt.Sprintf("%T", clientV3Loader),
		"pluginSources", fmt.Sprintf("%T", pluginSources),
		"pluginSettings", fmt.Sprintf("%T", pluginSettings),
		"accessControlService", fmt.Sprintf("%T", acService),
		"accessControl", fmt.Sprintf("%T", accessControl),
		"unified", fmt.Sprintf("%T", unified),
		"accessClient", fmt.Sprintf("%T", accessClient),
		"decrypter", fmt.Sprintf("%T", decrypter),
		"tracer", fmt.Sprintf("%T", tracer),
		"features", fmt.Sprintf("%T", features),
		"cfg", fmt.Sprintf("%T", cfg),
	)
	return emptyRoutesLoader{}
}

type emptyRoutesLoader struct{}

func (emptyRoutesLoader) Load(context.Context) ([]Backend, error) {
	return nil, nil
}

func (emptyRoutesLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

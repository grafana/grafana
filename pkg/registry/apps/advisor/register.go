package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type AdvisorAppProvider struct {
	app.Provider
	cfg *setting.Cfg
}

func RegisterApp(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	pluginContextProvider *plugincontext.Provider,
	pluginClient plugins.Client,
) *AdvisorAppProvider {
	provider := &AdvisorAppProvider{
		cfg: cfg,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     advisorapp.GetKinds(),
		CustomConfig: any(&advisorapp.AdvisorConfig{
			DatasourceSvc:         datasourceSvc,
			PluginStore:           pluginStore,
			PluginRepo:            pluginRepo,
			PluginContextProvider: pluginContextProvider,
			PluginClient:          pluginClient,
		}),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, advisorapp.New)
	return provider
}

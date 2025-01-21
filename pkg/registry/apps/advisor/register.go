package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type AdvisorAppProvider struct {
	app.Provider
}

func RegisterApp(
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginContextProvider datasource.PluginContextWrapper,
	pluginClient plugins.Client,
) *AdvisorAppProvider {
	provider := &AdvisorAppProvider{}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     advisorapp.GetKinds(),
		CustomConfig: any(&checks.AdvisorConfig{
			DatasourceSvc:         datasourceSvc,
			PluginStore:           pluginStore,
			PluginContextProvider: pluginContextProvider,
			PluginClient:          pluginClient,
		}),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, advisorapp.New)
	return provider
}

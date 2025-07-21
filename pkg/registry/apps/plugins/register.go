package plugins

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type AppProvider struct {
	app.Provider
}

func RegisterApp(_ *setting.Cfg) *AppProvider {
	provider := &AppProvider{}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: pluginsv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     pluginsapp.GetKinds(),
		Authorizer:       pluginsapp.GetAuthorizer(),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, pluginsapp.New)
	return provider
}

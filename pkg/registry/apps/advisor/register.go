package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type AdvisorAppProvider struct {
	app.Provider
}

func RegisterApp(
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
) *AdvisorAppProvider {
	provider := &AdvisorAppProvider{}
	pluginConfig := cfg.PluginSettings["grafana-advisor-app"]
	specificConfig := checkregistry.AdvisorAppConfig{
		CheckRegistry: checkRegistry,
		PluginConfig:  pluginConfig,
		StackID:       cfg.StackID,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     advisorapp.GetKinds(),
		Authorizer:       advisorapp.GetAuthorizer(),
		CustomConfig:     any(specificConfig),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, advisorapp.New)
	return provider
}

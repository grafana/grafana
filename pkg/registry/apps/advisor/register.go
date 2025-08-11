package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checkregistry"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
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
		OpenAPIDefGetter:         advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:             GetKinds(),
		Authorizer:               GetAuthorizer(),
		CustomConfig:             any(specificConfig),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, New)
	return provider
}

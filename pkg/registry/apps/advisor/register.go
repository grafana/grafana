package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
)

type AdvisorAppProvider struct {
	app.Provider
}

func RegisterApp(
	checkRegistry checkregistry.CheckService,
) *AdvisorAppProvider {
	provider := &AdvisorAppProvider{}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     advisorapp.GetKinds(),
		CustomConfig:     any(checkRegistry),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, advisorapp.New)
	return provider
}

package investigations

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/investigations/pkg/apis"
	investigationv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
	investigationapp "github.com/grafana/grafana/apps/investigations/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type InvestigationsAppProvider struct {
	app.Provider
	cfg *setting.Cfg
}

func RegisterApp(
	cfg *setting.Cfg,
) *InvestigationsAppProvider {
	provider := &InvestigationsAppProvider{
		cfg: cfg,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: investigationv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     investigationapp.GetKinds(),
		Authorizer:       investigationapp.GetAuthorizer(),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, investigationapp.New)
	return provider
}

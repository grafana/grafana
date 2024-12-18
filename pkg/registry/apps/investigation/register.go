package investigation

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/investigation/pkg/apis"
	investigationv1alpha1 "github.com/grafana/grafana/apps/investigation/pkg/apis/investigation/v1alpha1"
	investigationapp "github.com/grafana/grafana/apps/investigation/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type InvestigationAppProvider struct {
	app.Provider
	cfg *setting.Cfg
}

func RegisterApp(
	cfg *setting.Cfg,
) *InvestigationAppProvider {
	provider := &InvestigationAppProvider{
		cfg: cfg,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: investigationv1alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     investigationapp.GetKinds(),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, investigationapp.New)
	return provider
}

package prometheus

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/prometheus/pkg/apis"
	prometheusv0alpha1 "github.com/grafana/grafana/apps/prometheus/pkg/apis/prometheus/v0alpha1"
	prometheusapp "github.com/grafana/grafana/apps/prometheus/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/setting"
)

type CorrelationAppProvider struct {
	app.Provider
	cfg     *setting.Cfg
}

func RegisterApp(
	cfg *setting.Cfg,
) *CorrelationAppProvider {
	provider := &CorrelationAppProvider{
		cfg:     cfg
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: correlationv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds: correlationapp.GetKinds(),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, correlationapp.New)
	return provider
}

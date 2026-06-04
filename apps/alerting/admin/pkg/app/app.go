package app

import (
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/admin/pkg/apis/alertingadmin/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/admin/pkg/app/alertingconfig"
	"github.com/grafana/grafana/apps/alerting/admin/pkg/app/config"
)

func New(cfg app.Config) (app.App, error) {
	runtimeConfig, ok := cfg.SpecificConfig.(config.RuntimeConfig)
	if !ok {
		return nil, fmt.Errorf("invalid SpecificConfig type: expected config.RuntimeConfig, got %T", cfg.SpecificConfig)
	}

	simpleConfig := simple.AppConfig{
		Name:       "alerting.admin",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:      v0alpha1.AlertingConfigKind(),
				Validator: alertingconfig.NewValidator(runtimeConfig),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return a, nil
}

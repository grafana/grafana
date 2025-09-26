package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
)

func New(cfg app.Config) (app.App, error) {
	managedKinds := make([]simple.AppManagedKind, 0)
	for _, kinds := range apis.GetKinds() {
		for _, kind := range kinds {
			managedKinds = append(managedKinds, simple.AppManagedKind{Kind: kind})
		}
	}

	c := simple.AppConfig{
		Name:           "alerting.rules",
		KubeConfig:     cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{},
		ManagedKinds:   managedKinds,
	}

	a, err := simple.NewApp(c)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

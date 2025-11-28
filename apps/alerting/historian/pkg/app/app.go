package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
)

func New(cfg app.Config) (app.App, error) {
	runtimeConfig := cfg.SpecificConfig.(config.RuntimeConfig)

	simpleConfig := simple.AppConfig{
		Name:       "alerting.historian",
		KubeConfig: cfg.KubeConfig,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{
					Namespaced: true,
					Path:       "/alertstate/history",
					Method:     "GET",
				}: runtimeConfig.GetAlertStateHistoryHandler,
			},
		},
		// TODO: Remove when SDK is fixed.
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: v0alpha1.DummyKind(),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

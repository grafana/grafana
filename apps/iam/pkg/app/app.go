package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

var appManifestData = app.ManifestData{
	AppName: "iam",
	Group:   "iam.grafana.app",
}

func Provider(appCfg app.SpecificConfig) app.Provider {
	return simple.NewAppProvider(app.NewEmbeddedManifest(appManifestData), appCfg, New)
}

func New(cfg app.Config) (app.App, error) {
	config := simple.AppConfig{
		Name:       cfg.ManifestData.AppName,
		KubeConfig: cfg.KubeConfig,
	}

	a, err := simple.NewApp(config)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	return a, err
}

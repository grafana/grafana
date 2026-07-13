package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

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

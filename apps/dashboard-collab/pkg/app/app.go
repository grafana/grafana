package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

// New creates a new instance of the dashboard-collab app.
// This is a minimal scaffold — the collaboration service logic is added in later milestones.
func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "dashboard-collab",
		KubeConfig: cfg.KubeConfig,
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	return a, nil
}

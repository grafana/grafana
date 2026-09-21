package app

import (
	"fmt"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

// New creates the errortracking app. It has no managed kinds; its custom routes
// are backed by the app-owned SQL table.
func New(cfg sdkapp.Config) (sdkapp.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*Config)
	if !ok || specificConfig.Store == nil {
		return nil, fmt.Errorf("errortracking app requires a *app.Config with a Store")
	}

	return simple.NewApp(simple.AppConfig{
		Name:       "errortracking",
		KubeConfig: cfg.KubeConfig,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{Namespaced: true, Path: "events", Method: simple.AppCustomRouteMethodPost}: createEventHandler(specificConfig.Store),
				{Namespaced: true, Path: "events", Method: simple.AppCustomRouteMethodGet}:  listEventsHandler(specificConfig.Store),
			},
		},
	})
}

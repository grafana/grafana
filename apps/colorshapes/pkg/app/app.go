package app

import (
	"fmt"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

// New creates the colorshapes app. It has no managed kinds — it only serves the /hits
// custom routes, backed by its own SQL table (see apps/colorshapes/plan.md for why).
func New(cfg sdkapp.Config) (sdkapp.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*Config)
	if !ok || specificConfig.Store == nil {
		return nil, fmt.Errorf("colorshapes app requires a *app.Config with a Store")
	}

	return simple.NewApp(simple.AppConfig{
		Name:       "colorshapes",
		KubeConfig: cfg.KubeConfig,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{Namespaced: true, Path: "hits", Method: simple.AppCustomRouteMethodPost}:  createHitHandler(specificConfig.Store),
				{Namespaced: true, Path: "hits", Method: simple.AppCustomRouteMethodGet}:   listHitsHandler(specificConfig.Store),
				{Namespaced: true, Path: "events", Method: simple.AppCustomRouteMethodGet}: listEventsHandler(specificConfig.Store),
			},
		},
	})
}

package app

import (
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
)

type LiveConfig struct {
	Enable bool
}

func New(cfg app.Config) (app.App, error) {
	// APIPath needs to be set to `/apis`, as it defaults to empty
	cfg.KubeConfig.APIPath = "/apis"

	// The app has no kinds and stores nothing. The /ws route is in the manifest
	// so it is documented with other routes, but the host serves it as a raw
	// route outside the k8s handler chain (see NewWebsocketHandler). The handler
	// registered here only answers requests that reach the API server anyway.
	simpleConfig := simple.AppConfig{
		Name:       "live",
		KubeConfig: cfg.KubeConfig,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v1alpha1": {
				{
					Namespaced: true,
					Path:       WebsocketPath,
					Method:     http.MethodGet,
				}: websocketNotServedHandler,
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	// ValidateManifest ensures the capabilities in simple.AppConfig match the
	// capabilities described in the AppManifest.
	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	return map[schema.GroupVersion][]resource.Kind{}
}

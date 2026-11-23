package app

import (
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	livev1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
)

type LiveConfig struct {
	Enable bool
}

func New(cfg app.Config) (app.App, error) {
	// APIPath needs to be set to `/apis`, as it defaults to empty
	cfg.KubeConfig.APIPath = "/apis"

	// Nothing is stored. Channel is a read-only kind whose storage the host
	// replaces with a view of its Live node. The /ws route is in the manifest so
	// it is documented with other routes, but the host serves it as a raw route
	// outside the k8s handler chain (see NewWebsocketHandler). The handler
	// registered here only answers requests that reach the API server anyway.
	simpleConfig := simple.AppConfig{
		Name:       "live",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{Kind: livev1.ChannelKind()},
		},
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
	return map[schema.GroupVersion][]resource.Kind{
		livev1.GroupVersion: {livev1.ChannelKind()},
	}
}

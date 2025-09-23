package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
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
		Name:       "alerting.rules",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.DefaultLogger.With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: managedKinds,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				simple.AppVersionRoute{
					Namespaced: true,
					Path:       "fooo",
					Method:     "GET",
				}: func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
					writer.WriteHeader(444)
					return nil
				},
			},
		},
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

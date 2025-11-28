package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/notification"
)

func New(cfg app.Config) (app.App, error) {
	reg := prometheus.DefaultRegisterer
	tracer := otel.GetTracerProvider().Tracer("historian.alerting.app")
	logger := logging.DefaultLogger.With("app", "historian.alerting.app")

	runtimeConfig := cfg.SpecificConfig.(config.RuntimeConfig)

	notificationHandlers := notification.New(runtimeConfig.Notification, reg, logger, tracer)

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
				{
					Namespaced: true,
					Path:       "/notification/query",
					Method:     "POST",
				}: notificationHandlers.QueryHandler,
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

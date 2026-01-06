package app

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/notification"
)

func New(cfg app.Config) (app.App, error) {
	reg := prometheus.DefaultRegisterer
	tracer := otel.GetTracerProvider().Tracer("historian.alerting.app")
	logger := logging.DefaultLogger.With("app", "historian.alerting.app")

	runtimeConfig := cfg.SpecificConfig.(config.RuntimeConfig)

	alertStateHandler := runtimeConfig.GetAlertStateHistoryHandler
	if alertStateHandler == nil {
		alertStateHandler = NewErrorHandler("no alert state handler")
	}
	notificationHandler := notification.New(runtimeConfig.Notification, reg, logger, tracer)

	simpleConfig := simple.AppConfig{
		Name:       "alerting.historian",
		KubeConfig: cfg.KubeConfig,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{
					Namespaced: true,
					Path:       "/alertstate/history",
					Method:     "GET",
				}: alertStateHandler,
				{
					Namespaced: true,
					Path:       "/notification/query",
					Method:     "POST",
				}: notificationHandler.QueryHandler,
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

func NewErrorHandler(message string) simple.AppCustomRouteHandler {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: message,
			},
		}
	}
}

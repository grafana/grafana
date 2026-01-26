package notification

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
)

type Notification struct {
	loki   *LokiReader
	logger logging.Logger
}

func New(cfg config.NotificationConfig, reg prometheus.Registerer, logger logging.Logger, tracer trace.Tracer) *Notification {
	if !cfg.Enabled {
		return &Notification{}
	}
	return &Notification{
		loki:   NewLokiReader(cfg.Loki, reg, logger, tracer),
		logger: logger,
	}
}

func (n *Notification) QueryHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	if n.loki == nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: "notification history disabled",
			}}
	}

	var body v0alpha1.CreateNotificationqueryRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: err.Error(),
			}}
	}

	response, err := n.loki.Query(ctx, body)
	if err != nil {
		if errors.Is(err, ErrInvalidQuery) {
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest,
					Message: err.Error(),
				}}
		}
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: err.Error(),
			}}
	}

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}

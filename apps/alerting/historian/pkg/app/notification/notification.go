package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

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
	start := time.Now()

	if n.loki == nil {
		const msg = "Notification history query whilst disabled"
		n.logger.Debug(msg)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: msg,
			}}
	}

	var body v0alpha1.CreateNotificationqueryRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		const msg = "Notification history query malformed"
		n.logger.Debug(msg, "err", err)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	response, err := n.loki.Query(ctx, body)
	if err != nil {
		if errors.Is(err, ErrInvalidQuery) {
			const msg = "Notification history query invalid"
			n.logger.Debug(msg, "err", err)
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest,
					Message: fmt.Sprintf("%s: %s", msg, err.Error()),
				}}
		}
		const msg = "Notification history query failed"
		n.logger.Error(msg, "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	n.logger.Debug("Notification history query success",
		"entries", len(response.Entries),
		"duration", time.Since(start))

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}

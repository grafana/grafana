package annotation

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/infra/log"
)

// helper methods for observability operations

// statusLabel turns a Go error into a low-cardinality label
func statusLabel(err error) string {
	switch {
	case err == nil:
		return "ok"
	case isNotFound(err):
		return "not_found"
	case isAlreadyExists(err):
		return "conflict"
	case isForbidden(err):
		return "forbidden"
	case isBadRequest(err):
		return "bad_request"
	default:
		return "error"
	}
}

// isExpectedClientError reports whether err is part of normal API traffic
// useful to choose appropriate spans / events / label
func isExpectedClientError(err error) bool {
	return isNotFound(err) || isAlreadyExists(err) || isForbidden(err) || isBadRequest(err)
}

func isNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || apierrors.IsNotFound(err)
}

func isAlreadyExists(err error) bool {
	return errors.Is(err, ErrAlreadyExists) || apierrors.IsAlreadyExists(err)
}

func isForbidden(err error) bool {
	return apierrors.IsForbidden(err)
}

func isBadRequest(err error) bool {
	return errors.Is(err, ErrInvalidInput) || apierrors.IsBadRequest(err) || apierrors.IsInvalid(err)
}

// observe records the metric, structured log, and span tail for one
// annotation operation so all entry points emit consistent telemetry
func observe(ctx context.Context, logger log.Logger, histogram *prometheus.HistogramVec, op string, start time.Time, err error) {
	dur := time.Since(start)
	status := statusLabel(err)
	expected := err != nil && isExpectedClientError(err)
	unexpected := err != nil && !expected

	histogram.WithLabelValues(op, status).Observe(dur.Seconds())

	logger = logger.FromContext(ctx)
	if unexpected {
		logger.Error("annotation operation failed", "op", op, "status", status, "duration", dur, "error", err)
	} else {
		logger.Debug("annotation operation completed", "op", op, "status", status, "duration", dur)
	}

	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.String("status", status))
	switch {
	case unexpected:
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	case expected:
		span.AddEvent("client_error", trace.WithAttributes(
			attribute.String("status", status),
			attribute.String("message", err.Error()),
		))
	}
}

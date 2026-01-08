package tracing

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

// Tracer defines the service used to create new spans.
type Tracer interface {
	trace.Tracer

	// Inject adds identifying information for the span to the
	// headers defined in [http.Header] map (this mutates http.Header).
	Inject(context.Context, http.Header, trace.Span)
}

// Error sets the status to error and record the error as an exception in the provided span.
// This is a simplified version that works directly with OpenTelemetry spans.
func Error(span trace.Span, err error) error {
	if err == nil {
		return nil
	}
	span.SetStatus(codes.Error, err.Error())
	span.RecordError(err)
	return err
}

// NoopTracer returns a no-op tracer that can be used when tracing is not available.
func NoopTracer() trace.Tracer {
	return noop.NewTracerProvider().Tracer("")
}

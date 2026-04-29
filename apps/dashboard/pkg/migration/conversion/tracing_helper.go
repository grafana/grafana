// Copied from pkg/infra/tracing/tracing.go to avoid importing Grafana core

package conversion

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const instrumentationScope = "github.com/grafana/grafana/pkg/infra/tracing"

// Start only creates an OpenTelemetry span if the incoming context already includes a span.
func TracingStart(ctx context.Context, name string, attributes ...attribute.KeyValue) (context.Context, trace.Span) {
	return trace.SpanFromContext(ctx).TracerProvider().Tracer(instrumentationScope).Start(ctx, name, trace.WithAttributes(attributes...))
}

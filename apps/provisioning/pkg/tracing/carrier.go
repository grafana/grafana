// Package tracing carries a W3C trace context across storage boundaries (a
// Job, Repository, or Connection annotation) so that asynchronous processing
// -- often in a different operator process, reached via NATS or an apiserver
// watch -- can continue the trace that created the object instead of starting
// a disconnected root. It depends only on the OpenTelemetry API, not on
// pkg/infra/tracing, because apps/provisioning is a separate Go module.
package tracing

import (
	"context"

	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// propagator is fixed to W3C Trace Context, independent of whatever
// propagation format the process's global otel.TextMapPropagator is
// configured with (e.g. --grafana.tracing.otlp.propagation can be set to a
// non-W3C format). The annotation keys below are W3C-specific, and this
// carrier controls both the write and read side, so there is no
// interoperability reason to defer to the global, configurable propagator.
var propagator = propagation.TraceContext{}

// AnnoTraceParent and AnnoTraceState hold the W3C trace context of whatever
// created the annotated object, so a later, possibly out-of-process, reader
// can continue that trace.
const (
	AnnoTraceParent = "provisioning.grafana.app/traceparent"
	AnnoTraceState  = "provisioning.grafana.app/tracestate"
)

// Annotate stamps the span current in ctx onto annotations as a W3C trace
// context and returns the (possibly newly allocated) map. If ctx carries no
// valid span, annotations is returned unchanged -- there is nothing to
// propagate.
func Annotate(ctx context.Context, annotations map[string]string) map[string]string {
	if !trace.SpanContextFromContext(ctx).IsValid() {
		return annotations
	}

	carrier := propagation.MapCarrier{}
	propagator.Inject(ctx, carrier)

	traceparent := carrier.Get("traceparent")
	if traceparent == "" {
		return annotations
	}
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[AnnoTraceParent] = traceparent
	if tracestate := carrier.Get("tracestate"); tracestate != "" {
		annotations[AnnoTraceState] = tracestate
	}
	return annotations
}

// ExtractParent reconstructs the span context stamped by Annotate and returns
// a context that continues it as the parent of whatever span is started next.
// If annotations carries no valid trace context, ctx is returned unchanged.
func ExtractParent(ctx context.Context, annotations map[string]string) context.Context {
	traceparent := annotations[AnnoTraceParent]
	if traceparent == "" {
		return ctx
	}

	carrier := propagation.MapCarrier{"traceparent": traceparent}
	if tracestate := annotations[AnnoTraceState]; tracestate != "" {
		carrier["tracestate"] = tracestate
	}

	sc := trace.SpanContextFromContext(propagator.Extract(context.Background(), carrier))
	if !sc.IsValid() {
		return ctx
	}
	return trace.ContextWithRemoteSpanContext(ctx, sc)
}

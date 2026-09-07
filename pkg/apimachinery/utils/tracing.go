package utils

import (
	"context"

	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// AnnoKeyTraceParent and AnnoKeyTraceState hold the W3C trace context of
// whatever created or last wrote the resource, so that asynchronous
// processing of it -- often in a different process, reached via an operator's
// work queue rather than a direct call -- can continue that trace instead of
// starting a disconnected root. Any app-platform operator or controller that
// enqueues work keyed off a resource (rather than a live request) can use
// SetTraceContext/ExtractTraceContext to bridge the gap.
const (
	AnnoKeyTraceParent = "grafana.app/traceparent"
	AnnoKeyTraceState  = "grafana.app/tracestate"
)

// tracePropagator is fixed to W3C Trace Context, independent of whatever
// propagation format the process's global otel.TextMapPropagator is
// configured with. The annotation keys above are W3C-specific, and
// SetTraceContext/ExtractTraceContext control both the write and read side,
// so there is no interoperability reason to defer to the global, configurable
// propagator.
var tracePropagator = propagation.TraceContext{}

// SetTraceContext stamps the span current in ctx onto annotations as a W3C
// trace context and returns the (possibly newly allocated) map. If ctx
// carries no valid span, annotations is returned unchanged -- there is
// nothing to propagate.
func SetTraceContext(ctx context.Context, annotations map[string]string) map[string]string {
	if !trace.SpanContextFromContext(ctx).IsValid() {
		return annotations
	}

	carrier := propagation.MapCarrier{}
	tracePropagator.Inject(ctx, carrier)

	traceparent := carrier.Get("traceparent")
	if traceparent == "" {
		return annotations
	}
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[AnnoKeyTraceParent] = traceparent
	if tracestate := carrier.Get("tracestate"); tracestate != "" {
		annotations[AnnoKeyTraceState] = tracestate
	}
	return annotations
}

// ExtractTraceContext reconstructs the span context stamped by
// SetTraceContext and returns a context that continues it as the parent of
// whatever span is started next. If annotations carries no valid trace
// context, ctx is returned unchanged.
func ExtractTraceContext(ctx context.Context, annotations map[string]string) context.Context {
	traceparent := annotations[AnnoKeyTraceParent]
	if traceparent == "" {
		return ctx
	}

	carrier := propagation.MapCarrier{"traceparent": traceparent}
	if tracestate := annotations[AnnoKeyTraceState]; tracestate != "" {
		carrier["tracestate"] = tracestate
	}

	sc := trace.SpanContextFromContext(tracePropagator.Extract(context.Background(), carrier))
	if !sc.IsValid() {
		return ctx
	}
	return trace.ContextWithRemoteSpanContext(ctx, sc)
}

package apiserver

import (
	"context"

	oteltrace "go.opentelemetry.io/otel/trace"
	componentbasetracing "k8s.io/component-base/tracing"
)

// reparentingTracerProvider counteracts the Kubernetes apiserver's "public
// endpoint" request tracing.
//
// The upstream tracing filter (k8s.io/apiserver/pkg/endpoints/filters.WithTracing,
// installed inside DefaultBuildHandlerChain after authentication) runs otelhttp
// with WithPublicEndpointFn. For every caller that is not system:masters or
// system:monitoring — i.e. every normal user — otelhttp starts the request span
// as a NEW ROOT and demotes the incoming trace context to a mere link. The
// result is that a single /apis request is recorded as two disconnected traces:
// the client trace stops at the authentication filter and everything after it
// gets a fresh trace ID.
//
// Public-endpoint mode exists so an untrusted client cannot pick trace IDs or
// force sampling. In Grafana the gateway in front of the apiserver already owns
// that trust boundary, so re-rooting again at this interior hop protects nothing
// and only splits traces. This provider re-parents such spans back onto the
// linked remote context so the client trace continues unbroken. Honoring the
// remote context also lets the (trusted) client's sampling decision flow
// through, which is the intended behaviour once the gateway is the boundary.
type reparentingTracerProvider struct {
	componentbasetracing.TracerProvider
}

// newReparentingTracerProvider wraps tp so spans started in otelhttp
// public-endpoint mode are re-parented onto their incoming remote context.
func newReparentingTracerProvider(tp componentbasetracing.TracerProvider) componentbasetracing.TracerProvider {
	return reparentingTracerProvider{TracerProvider: tp}
}

func (p reparentingTracerProvider) Tracer(name string, opts ...oteltrace.TracerOption) oteltrace.Tracer {
	return reparentingTracer{Tracer: p.TracerProvider.Tracer(name, opts...)}
}

type reparentingTracer struct {
	oteltrace.Tracer
}

func (t reparentingTracer) Start(ctx context.Context, name string, opts ...oteltrace.SpanStartOption) (context.Context, oteltrace.Span) {
	ctx, opts = reparentPublicEndpointSpan(ctx, opts)
	return t.Tracer.Start(ctx, name, opts...)
}

// reparentPublicEndpointSpan detects the span-start options otelhttp produces in
// public-endpoint mode — WithNewRoot() plus the incoming remote span context as a
// link — and rewrites them so the span becomes a child of that remote context
// instead of a detached new root. Every other Start call is returned unchanged:
// only spans that are both new-root and carry a remote link are affected.
func reparentPublicEndpointSpan(ctx context.Context, opts []oteltrace.SpanStartOption) (context.Context, []oteltrace.SpanStartOption) {
	cfg := oteltrace.NewSpanStartConfig(opts...)
	if !cfg.NewRoot() {
		return ctx, opts
	}
	parent, remainingLinks, found := extractRemoteParent(cfg.Links())
	if !found {
		return ctx, opts
	}

	ctx = oteltrace.ContextWithRemoteSpanContext(ctx, parent)

	// Rebuild the options without WithNewRoot so the remote parent is honored,
	// preserving everything else otelhttp set (attributes, span kind, timestamp,
	// and any non-parent links).
	rebuilt := make([]oteltrace.SpanStartOption, 0, 4)
	if attrs := cfg.Attributes(); len(attrs) > 0 {
		rebuilt = append(rebuilt, oteltrace.WithAttributes(attrs...))
	}
	if len(remainingLinks) > 0 {
		rebuilt = append(rebuilt, oteltrace.WithLinks(remainingLinks...))
	}
	if ts := cfg.Timestamp(); !ts.IsZero() {
		rebuilt = append(rebuilt, oteltrace.WithTimestamp(ts))
	}
	rebuilt = append(rebuilt, oteltrace.WithSpanKind(cfg.SpanKind()))
	return ctx, rebuilt
}

// extractRemoteParent returns the first remote link — the incoming trace context
// otelhttp preserved as a link in public-endpoint mode — to use as the parent,
// along with the remaining links to keep.
func extractRemoteParent(links []oteltrace.Link) (oteltrace.SpanContext, []oteltrace.Link, bool) {
	for i, l := range links {
		if l.SpanContext.IsValid() && l.SpanContext.IsRemote() {
			remaining := make([]oteltrace.Link, 0, len(links)-1)
			remaining = append(remaining, links[:i]...)
			remaining = append(remaining, links[i+1:]...)
			return l.SpanContext, remaining, true
		}
	}
	return oteltrace.SpanContext{}, links, false
}

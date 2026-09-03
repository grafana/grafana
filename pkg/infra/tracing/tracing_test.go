package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

func TestInitSampler(t *testing.T) {
	otel := &TracingService{}
	otel.cfg = NewEmptyTracingConfig()
	sampler, err := otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "AlwaysOffSampler", sampler.Description())

	otel.cfg.Sampler = "bogus"
	_, err = otel.initSampler()
	require.Error(t, err)

	otel.cfg.Sampler = "const"
	otel.cfg.SamplerParam = 0.5
	_, err = otel.initSampler()
	require.Error(t, err)

	otel.cfg.Sampler = "const"
	otel.cfg.SamplerParam = 1.0
	sampler, err = otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "AlwaysOnSampler", sampler.Description())

	otel.cfg.Sampler = "probabilistic"
	otel.cfg.SamplerParam = 0.5
	sampler, err = otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "TraceIDRatioBased{0.5}", sampler.Description())

	otel.cfg.Sampler = "rateLimiting"
	otel.cfg.SamplerParam = 100.25
	sampler, err = otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "RateLimitingSampler{100.25}", sampler.Description())
}

func TestInfraEndpointFilterSampler(t *testing.T) {
	// AlwaysSample as the delegate makes a non-dropped decision observable.
	sampler := newInfraEndpointFilterSampler(tracesdk.AlwaysSample())

	sample := func(kind trace.SpanKind, attrs ...attribute.KeyValue) tracesdk.SamplingDecision {
		return sampler.ShouldSample(tracesdk.SamplingParameters{
			ParentContext: context.Background(),
			Kind:          kind,
			Attributes:    attrs,
		}).Decision
	}

	tests := []struct {
		name string
		kind trace.SpanKind
		attr attribute.KeyValue
		want tracesdk.SamplingDecision
	}{
		{"pprof profile with query (http.target)", trace.SpanKindServer, attribute.String("http.target", "/debug/pprof/profile?seconds=14"), tracesdk.Drop},
		{"pprof profile (url.path)", trace.SpanKindServer, attribute.String("url.path", "/debug/pprof/profile"), tracesdk.Drop},
		{"pprof profile with query (http.url from RequestTracing)", trace.SpanKindServer, attribute.String("http.url", "/debug/pprof/profile?seconds=14"), tracesdk.Drop},
		{"pprof index prefix", trace.SpanKindServer, attribute.String("url.path", "/debug/pprof/heap"), tracesdk.Drop},
		{"pprof exact path", trace.SpanKindServer, attribute.String("url.path", "/debug/pprof"), tracesdk.Drop},
		{"metrics", trace.SpanKindServer, attribute.String("url.path", "/metrics"), tracesdk.Drop},
		{"metrics via http.url", trace.SpanKindServer, attribute.String("http.url", "/metrics"), tracesdk.Drop},
		{"healthz", trace.SpanKindServer, attribute.String("url.path", "/healthz"), tracesdk.Drop},
		{"readyz", trace.SpanKindServer, attribute.String("url.path", "/readyz"), tracesdk.Drop},
		{"livez", trace.SpanKindServer, attribute.String("url.path", "/livez"), tracesdk.Drop},
		{"api path is kept", trace.SpanKindServer, attribute.String("url.path", "/apis/dashboard.grafana.app/v1beta1/dashboards"), tracesdk.RecordAndSample},
		{"path merely containing metrics is kept", trace.SpanKindServer, attribute.String("url.path", "/api/datasources/proxy/metrics"), tracesdk.RecordAndSample},
		{"pprof prefix without boundary is kept", trace.SpanKindServer, attribute.String("url.path", "/debug/pprofiler"), tracesdk.RecordAndSample},
		{"non-server pprof span is kept", trace.SpanKindClient, attribute.String("url.path", "/debug/pprof/profile"), tracesdk.RecordAndSample},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, sample(tt.kind, tt.attr))
		})
	}

	// A server span with no path attribute must fall through to the delegate.
	assert.Equal(t, tracesdk.RecordAndSample, sample(trace.SpanKindServer))
}

// TestInfraEndpointFilterSampler_OutermostOverParentBased verifies the filter is
// composed as the outermost sampler: a request arriving with a sampled remote
// parent must still have its operational-endpoint span dropped, even though
// ParentBased would otherwise honor the parent's sampling decision.
func TestInfraEndpointFilterSampler_OutermostOverParentBased(t *testing.T) {
	// NeverSample as the ParentBased root proves the sampling seen for non-infra
	// paths comes from the parent, not the root sampler.
	sampler := newInfraEndpointFilterSampler(tracesdk.ParentBased(tracesdk.NeverSample()))

	sampledParent := trace.ContextWithSpanContext(context.Background(), trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    trace.TraceID{0x01},
		SpanID:     trace.SpanID{0x01},
		TraceFlags: trace.FlagsSampled,
		Remote:     true,
	}))

	sample := func(path string) tracesdk.SamplingDecision {
		return sampler.ShouldSample(tracesdk.SamplingParameters{
			ParentContext: sampledParent,
			Kind:          trace.SpanKindServer,
			Attributes:    []attribute.KeyValue{attribute.String("url.path", path)},
		}).Decision
	}

	// Dropped despite the sampled parent.
	assert.Equal(t, tracesdk.Drop, sample("/metrics"))
	assert.Equal(t, tracesdk.Drop, sample("/debug/pprof/profile"))
	// Non-infra path defers to ParentBased, which honors the sampled parent.
	assert.Equal(t, tracesdk.RecordAndSample, sample("/apis/dashboard.grafana.app/v1beta1/dashboards"))
}

func TestStart(t *testing.T) {
	name := "test-span"
	attributes := []attribute.KeyValue{
		attribute.String("test1", "1"),
		attribute.Int("test2", 2),
	}

	t.Run("should return noop span if there is not currently a span in context", func(t *testing.T) {
		ctx := context.Background()
		_, span := Start(ctx, name, attributes...)
		defer span.End()

		require.NotNil(t, span)
		require.False(t, span.SpanContext().IsValid())
	})

	t.Run("should return a span with a valid span context if there is currently a span in context", func(t *testing.T) {
		spanCtx := trace.NewSpanContext(trace.SpanContextConfig{
			TraceID:    trace.TraceID{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16},
			SpanID:     trace.SpanID{1, 2, 3, 4, 5, 6, 7, 8},
			TraceFlags: trace.FlagsSampled,
		})

		ctx := trace.ContextWithSpanContext(context.Background(), spanCtx)
		_, childSpan := Start(ctx, name, attributes...)
		defer childSpan.End()

		require.NotNil(t, childSpan)
		require.Equal(t, spanCtx.TraceID(), childSpan.SpanContext().TraceID())
		require.True(t, childSpan.SpanContext().IsValid())
	})
}

// TestInitTracerProvider_FilterOperationalEndpointsToggle verifies the config
// toggle actually gates the filter at the provider level: when enabled an
// operational-endpoint server span is dropped, when disabled it is exported.
func TestInitTracerProvider_FilterOperationalEndpointsToggle(t *testing.T) {
	recordMetricsSpan := func(t *testing.T, filter bool) int {
		t.Helper()
		exp := tracetest.NewInMemoryExporter()
		tp, err := initTracerProvider(exp, "grafana", "test", tracesdk.AlwaysSample(), filter)
		require.NoError(t, err)
		t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

		_, span := tp.Tracer("test").Start(context.Background(), "GET",
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(attribute.String("url.path", "/metrics")),
		)
		span.End()
		require.NoError(t, tp.ForceFlush(context.Background()))
		return len(exp.GetSpans())
	}

	assert.Equal(t, 0, recordMetricsSpan(t, true), "filter enabled should drop the /metrics span")
	assert.Equal(t, 1, recordMetricsSpan(t, false), "filter disabled should export the /metrics span")
}

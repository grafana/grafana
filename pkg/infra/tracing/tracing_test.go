package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
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

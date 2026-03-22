package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"	
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

func TestInitJaegerTracerProvider_AddressParsing(t *testing.T) {
	tests := []struct {
		name        string
		address     string
		expectError bool
	}{
		{
			name:        "valid http URL",
			address:     "http://localhost:4318",
			expectError: false,
		},
		{
			name:        "valid https URL",
			address:     "https://jaeger.example.com:4318",
			expectError: false,
		},
		{
			name:        "valid http URL with path",
			address:     "http://localhost:4318/v1/traces",
			expectError: false,
		},
		{
			name:        "valid host:port",
			address:     "localhost:4318",
			expectError: false,
		},
		{
			name:        "invalid address",
			address:     "not-a-valid-address",
			expectError: true,
		},
		{
			name:        "empty address",
			address:     "",
			expectError: true,
		},
		{
			name:        "legacy jaeger agent port 6831",
			address:     "localhost:6831",
			expectError: false, // Address is valid, but should log a warning
		},
		{
			name:        "legacy jaeger collector path",
			address:     "http://localhost:14268/api/traces",
			expectError: false, // Address is valid, but should log a warning
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ots := &TracingService{
				cfg: &TracingConfig{
					Address:      tt.address,
					Sampler:      "const",
					SamplerParam: 1.0,
				},
				log: log.New("test"),
			}
			_, err := ots.initJaegerTracerProvider()
			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), "invalid tracer address")
			} else {
				// Provider creation may fail due to no real endpoint,
				// but address parsing should succeed
				if err != nil {
					assert.NotContains(t, err.Error(), "invalid tracer address")
				}
			}
		})
	}
}

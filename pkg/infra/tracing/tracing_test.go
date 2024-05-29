package tracing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

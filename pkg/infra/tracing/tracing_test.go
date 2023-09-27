package tracing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/setting"
)

// TODO(zserge) Add proper tests for opentelemetry

func TestSplitCustomAttribs(t *testing.T) {
	tests := []struct {
		input    string
		expected []attribute.KeyValue
	}{
		{
			input:    "key1:value:1",
			expected: []attribute.KeyValue{attribute.String("key1", "value:1")},
		},
		{
			input: "key1:value1,key2:value2",
			expected: []attribute.KeyValue{
				attribute.String("key1", "value1"),
				attribute.String("key2", "value2"),
			},
		},
		{
			input:    "",
			expected: []attribute.KeyValue{},
		},
	}

	for _, test := range tests {
		attribs, err := splitCustomAttribs(test.input)
		assert.NoError(t, err)
		assert.EqualValues(t, test.expected, attribs)
	}
}

func TestSplitCustomAttribs_Malformed(t *testing.T) {
	tests := []struct {
		input string
	}{
		{input: "key1=value1"},
		{input: "key1"},
	}

	for _, test := range tests {
		_, err := splitCustomAttribs(test.input)
		assert.Error(t, err)
	}
}

func TestTracingConfig(t *testing.T) {
	for _, test := range []struct {
		Name               string
		Cfg                string
		Env                map[string]string
		ExpectedExporter   string
		ExpectedAddress    string
		ExpectedPropagator string
		ExpectedAttrs      []attribute.KeyValue

		ExpectedSampler           string
		ExpectedSamplerParam      float64
		ExpectedSamplingServerURL string
	}{
		{
			Name:             "default config uses noop exporter",
			Cfg:              "",
			ExpectedExporter: noopExporter,
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "custom attributes are parsed",
			Cfg: `
			[tracing.opentelemetry]
			custom_attributes = key1:value1,key2:value2
			`,
			ExpectedExporter: noopExporter,
			ExpectedAttrs:    []attribute.KeyValue{attribute.String("key1", "value1"), attribute.String("key2", "value2")},
		},
		{
			Name: "jaeger address is parsed",
			Cfg: `
			[tracing.opentelemetry.jaeger]
			address = jaeger.example.com:6831
			`,
			ExpectedExporter: jaegerExporter,
			ExpectedAddress:  "jaeger.example.com:6831",
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "OTLP address is parsed",
			Cfg: `
			[tracing.opentelemetry.otlp]
			address = otlp.example.com:4317
			`,
			ExpectedExporter: otlpExporter,
			ExpectedAddress:  "otlp.example.com:4317",
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "legacy config format is supported",
			Cfg: `
			[tracing.jaeger]
			address = jaeger.example.com:6831
			`,
			ExpectedExporter: jaegerExporter,
			ExpectedAddress:  "jaeger.example.com:6831",
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "legacy env variables are supported",
			Cfg:  `[tracing.jaeger]`,
			Env: map[string]string{
				"JAEGER_AGENT_HOST": "example.com",
				"JAEGER_AGENT_PORT": "12345",
			},
			ExpectedExporter: jaegerExporter,
			ExpectedAddress:  "example.com:12345",
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "opentelemetry config format is prioritised over legacy jaeger",
			Cfg: `
			[tracing.jaeger]
			address = foo.com:6831
			custom_tags = a:b
			sampler_param = 0
			[tracing.opentelemetry]
			custom_attributes = c:d
			sampler_param = 1
			[tracing.opentelemetry.jaeger]
			address = bar.com:6831
			`,
			ExpectedExporter:     jaegerExporter,
			ExpectedAddress:      "bar.com:6831",
			ExpectedAttrs:        []attribute.KeyValue{attribute.String("c", "d")},
			ExpectedSamplerParam: 1.0,
		},
		{
			Name: "remote sampler config is parsed from otel config",
			Cfg: `
			[tracing.opentelemetry]
			sampler_type = remote
			sampler_param = 0.5
			sampling_server_url = http://example.com:5778/sampling
			[tracing.opentelemetry.otlp]
			address = otlp.example.com:4317
			`,
			ExpectedExporter:          otlpExporter,
			ExpectedAddress:           "otlp.example.com:4317",
			ExpectedAttrs:             []attribute.KeyValue{},
			ExpectedSampler:           "remote",
			ExpectedSamplerParam:      0.5,
			ExpectedSamplingServerURL: "http://example.com:5778/sampling",
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			// export environment variables
			if test.Env != nil {
				for k, v := range test.Env {
					t.Setenv(k, v)
				}
			}
			// parse config sections
			cfg := setting.NewCfg()
			err := cfg.Raw.Append([]byte(test.Cfg))
			assert.NoError(t, err)
			// create tracer
			tracer, err := ProvideService(cfg)
			assert.NoError(t, err)
			// make sure tracker is properly configured
			otel := tracer.(*Opentelemetry)
			assert.Equal(t, test.ExpectedExporter, otel.enabled)
			assert.Equal(t, test.ExpectedAddress, otel.Address)
			assert.Equal(t, test.ExpectedPropagator, otel.Propagation)
			assert.Equal(t, test.ExpectedAttrs, otel.customAttribs)

			if test.ExpectedSampler != "" {
				assert.Equal(t, test.ExpectedSampler, otel.sampler)
				assert.Equal(t, test.ExpectedSamplerParam, otel.samplerParam)
				assert.Equal(t, test.ExpectedSamplingServerURL, otel.samplerRemoteURL)
			}
		})
	}
}

func TestInitSampler(t *testing.T) {
	otel := &Opentelemetry{}
	sampler, err := otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "AlwaysOffSampler", sampler.Description())

	otel.sampler = "bogus"
	_, err = otel.initSampler()
	require.Error(t, err)

	otel.sampler = "const"
	otel.samplerParam = 0.5
	_, err = otel.initSampler()
	require.Error(t, err)

	otel.sampler = "const"
	otel.samplerParam = 1.0
	sampler, err = otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "AlwaysOnSampler", sampler.Description())

	otel.sampler = "probabilistic"
	otel.samplerParam = 0.5
	sampler, err = otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "TraceIDRatioBased{0.5}", sampler.Description())

	otel.sampler = "rateLimiting"
	otel.samplerParam = 100.25
	sampler, err = otel.initSampler()
	require.NoError(t, err)
	assert.Equal(t, "RateLimitingSampler{100.25}", sampler.Description())
}

package tracing

import (
	"testing"

	"github.com/stretchr/testify/assert"
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
		ExpectedInsecure   bool
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
			ExpectedInsecure: true,
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "custom attributes are parsed",
			Cfg: `
			[tracing.opentelemetry]
			custom_attributes = key1:value1,key2:value2
			`,
			ExpectedExporter: noopExporter,
			ExpectedInsecure: true,
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
			ExpectedInsecure: true,
			ExpectedAttrs:    []attribute.KeyValue{},
		},
		{
			Name: "OTLP insecure is parsed",
			Cfg: `
			[tracing.opentelemetry.otlp]
			address = otlp.example.com:4317
			insecure = false
			`,
			ExpectedExporter: otlpExporter,
			ExpectedAddress:  "otlp.example.com:4317",
			ExpectedInsecure: false,
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
			ExpectedInsecure:          true,
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
			// create tracingConfig
			tracingConfig, err := ProvideTracingConfig(cfg)
			assert.NoError(t, err)
			// make sure tracker is properly configured
			assert.Equal(t, test.ExpectedExporter, tracingConfig.enabled)
			assert.Equal(t, test.ExpectedAddress, tracingConfig.Address)
			assert.Equal(t, test.ExpectedPropagator, tracingConfig.Propagation)
			assert.Equal(t, test.ExpectedAttrs, tracingConfig.CustomAttribs)
			assert.Equal(t, test.ExpectedInsecure, tracingConfig.Insecure)

			if test.ExpectedSampler != "" {
				assert.Equal(t, test.ExpectedSampler, tracingConfig.Sampler)
				assert.Equal(t, test.ExpectedSamplerParam, tracingConfig.SamplerParam)
				assert.Equal(t, test.ExpectedSamplingServerURL, tracingConfig.SamplerRemoteURL)
			}
		})
	}
}

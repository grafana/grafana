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
		ExpectedPropagator string
		ExpectedAttrs      []attribute.KeyValue
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
			[tracing.opentelemetry]
			custom_attributes = c:d
			[tracing.opentelemetry.jaeger]
			address = bar.com:6831
			`,
			ExpectedExporter: jaegerExporter,
			ExpectedAddress:  "bar.com:6831",
			ExpectedAttrs:    []attribute.KeyValue{attribute.String("c", "d")},
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
		})
	}
}

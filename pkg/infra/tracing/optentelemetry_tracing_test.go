package tracing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/setting"
)

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
		input    string
		expected []attribute.KeyValue
	}{
		{input: "key1=value1"},
		{input: "key1"},
	}

	for _, test := range tests {
		_, err := splitCustomAttribs(test.input)
		assert.Error(t, err)
	}
}

func TestOptentelemetry_ParseSettingsOpentelemetry(t *testing.T) {
	cfg := setting.NewCfg()
	otel := &Opentelemetry{Cfg: cfg}

	otelsect := cfg.Raw.Section("tracing.opentelemetry")
	jaegersect := cfg.Raw.Section("tracing.opentelemetry.jaeger")
	otlpsect := cfg.Raw.Section("tracing.opentelemetry.otlp")

	assert.NoError(t, otel.parseSettingsOpentelemetry())
	assert.Equal(t, noopExporter, otel.Enabled)

	otelsect.Key("custom_attributes")
	assert.NoError(t, otel.parseSettingsOpentelemetry())
	assert.Empty(t, otel.customAttribs)

	otelsect.Key("custom_attributes").SetValue("key1:value1,key2:value2")
	assert.NoError(t, otel.parseSettingsOpentelemetry())
	expected := []attribute.KeyValue{
		attribute.String("key1", "value1"),
		attribute.String("key2", "value2"),
	}
	assert.Equal(t, expected, otel.customAttribs)

	jaegersect.Key("address").SetValue("somehost:6831")
	assert.NoError(t, otel.parseSettingsOpentelemetry())
	assert.Equal(t, "somehost:6831", otel.Address)
	assert.Equal(t, jaegerExporter, otel.Enabled)

	jaegersect.Key("address").SetValue("")
	otlpsect.Key("address").SetValue("somehost:4317")
	assert.NoError(t, otel.parseSettingsOpentelemetry())
	assert.Equal(t, "somehost:4317", otel.Address)
	assert.Equal(t, otlpExporter, otel.Enabled)
}

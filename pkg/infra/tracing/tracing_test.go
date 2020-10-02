package tracing

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupSplit(t *testing.T) {
	tests := []struct {
		input    string
		expected map[string]string
	}{
		{
			input: "tag1:value1,tag2:value2",
			expected: map[string]string{
				"tag1": "value1",
				"tag2": "value2",
			},
		},
		{
			input:    "",
			expected: map[string]string{},
		},
		{
			input:    "tag1",
			expected: map[string]string{},
		},
	}

	for _, test := range tests {
		tags := splitTagSettings(test.input)
		for k, v := range test.expected {
			value, exists := tags[k]
			assert.Truef(t, exists, "Tag %q not found for input %q", k, test.input)
			assert.Equalf(t, v, value, "Tag %q has wrong value for input %q", k, test.input)
		}
	}
}

func TestInitJaegerCfg_Default(t *testing.T) {
	ts := &TracingService{}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.True(t, cfg.Disabled)
}

func TestInitJaegerCfg_Enabled(t *testing.T) {
	ts := &TracingService{enabled: true}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.False(t, cfg.Disabled)
	assert.Equal(t, "localhost:6831", cfg.Reporter.LocalAgentHostPort)
}

func TestInitJaegerCfg_DisabledViaEnv(t *testing.T) {
	os.Setenv("JAEGER_DISABLED", "true")
	defer func() {
		os.Unsetenv("JAEGER_DISABLED")
	}()

	ts := &TracingService{enabled: true}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.True(t, cfg.Disabled)
}

func TestInitJaegerCfg_EnabledViaEnv(t *testing.T) {
	os.Setenv("JAEGER_DISABLED", "false")
	defer func() {
		os.Unsetenv("JAEGER_DISABLED")
	}()

	ts := &TracingService{enabled: false}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.False(t, cfg.Disabled)
}

func TestInitJaegerCfg_InvalidEnvVar(t *testing.T) {
	os.Setenv("JAEGER_DISABLED", "totallybogus")
	defer func() {
		os.Unsetenv("JAEGER_DISABLED")
	}()

	ts := &TracingService{}
	_, err := ts.initJaegerCfg()
	require.EqualError(t, err, "cannot parse env var JAEGER_DISABLED=totallybogus: strconv.ParseBool: parsing \"totallybogus\": invalid syntax")
}

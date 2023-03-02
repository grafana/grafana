package tracing

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
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
	ts := &Opentracing{}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.True(t, cfg.Disabled)
}

func TestInitJaegerCfg_Enabled(t *testing.T) {
	ts := &Opentracing{enabled: true}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.False(t, cfg.Disabled)
	assert.Equal(t, "localhost:6831", cfg.Reporter.LocalAgentHostPort)
}

func TestInitJaegerCfg_DisabledViaEnv(t *testing.T) {
	err := os.Setenv("JAEGER_DISABLED", "true")
	require.NoError(t, err)
	defer func() {
		err := os.Unsetenv("JAEGER_DISABLED")
		require.NoError(t, err)
	}()

	ts := &Opentracing{enabled: true}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.True(t, cfg.Disabled)
}

func TestInitJaegerCfg_EnabledViaEnv(t *testing.T) {
	err := os.Setenv("JAEGER_DISABLED", "false")
	require.NoError(t, err)
	defer func() {
		err := os.Unsetenv("JAEGER_DISABLED")
		require.NoError(t, err)
	}()

	ts := &Opentracing{enabled: false}
	cfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.False(t, cfg.Disabled)
}

func TestInitJaegerCfg_InvalidEnvVar(t *testing.T) {
	err := os.Setenv("JAEGER_DISABLED", "totallybogus")
	require.NoError(t, err)
	defer func() {
		err := os.Unsetenv("JAEGER_DISABLED")
		require.NoError(t, err)
	}()

	ts := &Opentracing{}
	_, err = ts.initJaegerCfg()
	require.EqualError(t, err, "cannot parse env var JAEGER_DISABLED=totallybogus: strconv.ParseBool: parsing \"totallybogus\": invalid syntax")
}

func TestInitJaegerCfg_EnabledViaHost(t *testing.T) {
	require.NoError(t, os.Setenv("JAEGER_AGENT_HOST", "example.com"))
	defer func() {
		require.NoError(t, os.Unsetenv("JAEGER_AGENT_HOST"))
	}()

	cfg := setting.NewCfg()
	ts := &Opentracing{Cfg: cfg}
	_, err := ts.Cfg.Raw.NewSection("tracing.jaeger")
	require.NoError(t, err)
	require.NoError(t, ts.parseSettings())
	jaegerCfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.False(t, jaegerCfg.Disabled)
	assert.Equal(t, "example.com:6831", jaegerCfg.Reporter.LocalAgentHostPort)
}

func TestInitJaegerCfg_EnabledViaHostPort(t *testing.T) {
	require.NoError(t, os.Setenv("JAEGER_AGENT_HOST", "example.com"))
	require.NoError(t, os.Setenv("JAEGER_AGENT_PORT", "12345"))
	defer func() {
		require.NoError(t, os.Unsetenv("JAEGER_AGENT_HOST"))
		require.NoError(t, os.Unsetenv("JAEGER_AGENT_PORT"))
	}()

	cfg := setting.NewCfg()
	ts := &Opentracing{Cfg: cfg}
	_, err := ts.Cfg.Raw.NewSection("tracing.jaeger")
	require.NoError(t, err)
	require.NoError(t, ts.parseSettings())
	jaegerCfg, err := ts.initJaegerCfg()
	require.NoError(t, err)

	assert.False(t, jaegerCfg.Disabled)
	assert.Equal(t, "example.com:12345", jaegerCfg.Reporter.LocalAgentHostPort)
}

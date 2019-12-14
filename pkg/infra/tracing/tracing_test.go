package tracing

import (
	"os"
	"testing"
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
			if !exists || value != v {
				t.Errorf("tags does not match %v ", test)
			}
		}
	}
}

func TestInitJaegerCfg(t *testing.T) {
	ts := &TracingService{}
	cfg, err := ts.initJaegerCfg()
	if err != nil {
		t.Error(err)
	}
	if !cfg.Disabled {
		t.Errorf("jaeger should be disabled by default")
	}

	ts = &TracingService{enabled: true}
	cfg, err = ts.initJaegerCfg()
	if err != nil {
		t.Error(err)
	}

	if cfg.Disabled {
		t.Errorf("jaeger should have been enabled")
	}
	if cfg.Reporter.LocalAgentHostPort != "localhost:6831" {
		t.Errorf("jaeger address should be set to default: %s", cfg.Reporter.LocalAgentHostPort)
	}

	os.Setenv("JAEGER_DISABLED", "true")
	ts = &TracingService{enabled: true}
	cfg, err = ts.initJaegerCfg()
	os.Unsetenv("JAEGER_DISABLED")
	if err != nil {
		t.Error(err)
	}
	if !cfg.Disabled {
		t.Errorf("JAEGER_DISABLED env var should take precedence")
	}

	os.Setenv("JAEGER_DISABLED", "false")
	ts = &TracingService{}
	cfg, err = ts.initJaegerCfg()
	os.Unsetenv("JAEGER_DISABLED")
	if err != nil {
		t.Error(err)
	}
	if cfg.Disabled {
		t.Errorf("JAEGER_DISABLED env var should take precedence")
	}

	os.Setenv("JAEGER_DISABLED", "totallybogus")
	ts = &TracingService{}
	cfg, err = ts.initJaegerCfg()
	os.Unsetenv("JAEGER_DISABLED")
	if err == nil {
		t.Errorf("invalid boolean should return error")
	}
}

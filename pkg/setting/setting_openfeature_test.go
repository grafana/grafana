package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_CtxAttrs(t *testing.T) {
	testCases := []struct {
		name     string
		conf     string
		expected map[string]any
	}{
		{
			name: "empty config - only default attributes should be present",
			expected: map[string]any{
				"grafana_version": "",
			},
		},
		{
			name: "config with some attributes",
			conf: `
[feature_toggles.openfeature.context]
foo = bar
baz = qux
quux = corge`,
			expected: map[string]any{
				"foo":             "bar",
				"baz":             "qux",
				"quux":            "corge",
				"grafana_version": "",
			},
		},
		{
			name: "config with an attribute that overrides a default one",
			conf: `
[feature_toggles.openfeature.context]
grafana_version = 10.0.0
foo = bar`,
			expected: map[string]any{
				"grafana_version": "10.0.0",
				"foo":             "bar",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := NewCfgFromBytes([]byte(tc.conf))
			require.NoError(t, err)

			assert.Equal(t, tc.expected, cfg.OpenFeature.ContextAttrs)
		})
	}
}

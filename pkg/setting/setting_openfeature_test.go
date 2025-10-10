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
		expected map[string]string
	}{
		{
			name: "empty config - only default attributes should be present",
			expected: map[string]string{
				"grafana_version": "",
				"namespace":       "default",
			},
		},
		{
			name: "config with some attributes",
			conf: `
[feature_toggles.openfeature.context]
foo = bar
baz = qux
quux = corge`,
			expected: map[string]string{
				"foo":             "bar",
				"baz":             "qux",
				"quux":            "corge",
				"grafana_version": "",
				"namespace":       "default",
			},
		},
		{
			name: "config with an attribute that overrides a default one",
			conf: `
[feature_toggles.openfeature.context]
grafana_version = 10.0.0
foo = bar`,
			expected: map[string]string{
				"grafana_version": "10.0.0",
				"foo":             "bar",
				"namespace":       "default",
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

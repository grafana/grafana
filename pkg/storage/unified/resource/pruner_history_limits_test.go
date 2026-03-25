package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLookupCustomPrunerHistoryLimit(t *testing.T) {
	tests := []struct {
		name     string
		group    string
		resource string
		expected int
		ok       bool
	}{
		{
			name:     "returns custom limit for plugins",
			group:    "plugins.grafana.app",
			resource: "plugins",
			expected: 3,
			ok:       true,
		},
		{
			name:     "returns not found for other resources",
			group:    "dashboard.grafana.app",
			resource: "dashboards",
			expected: 0,
			ok:       false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			limit, ok := LookupCustomPrunerHistoryLimit(tc.group, tc.resource)
			require.Equal(t, tc.ok, ok)
			require.Equal(t, tc.expected, limit)
		})
	}
}

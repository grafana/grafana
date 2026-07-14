package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLookupPrunerHistoryLimit(t *testing.T) {
	tests := []struct {
		name                    string
		group                   string
		resource                string
		dashboardVersionsToKeep int
		expected                int
	}{
		{
			name:                    "returns custom limit for plugins",
			group:                   "plugins.grafana.app",
			resource:                "plugins",
			dashboardVersionsToKeep: 20,
			expected:                3,
		},
		{
			name:                    "returns configured limit for dashboards",
			group:                   "dashboard.grafana.app",
			resource:                "dashboards",
			dashboardVersionsToKeep: 25,
			expected:                25,
		},
		{
			name:                    "clamps dashboard versions to minimum of 1",
			group:                   "dashboard.grafana.app",
			resource:                "dashboards",
			dashboardVersionsToKeep: 0,
			expected:                1,
		},
		{
			name:                    "clamps negative dashboard versions to minimum of 1",
			group:                   "dashboard.grafana.app",
			resource:                "dashboards",
			dashboardVersionsToKeep: -5,
			expected:                1,
		},
		{
			name:                    "returns default limit for other resources",
			group:                   "some.app",
			resource:                "resources",
			dashboardVersionsToKeep: 100,
			expected:                20,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			limit := LookupPrunerHistoryLimit(tc.group, tc.resource, tc.dashboardVersionsToKeep)
			require.Equal(t, tc.expected, limit)
		})
	}
}

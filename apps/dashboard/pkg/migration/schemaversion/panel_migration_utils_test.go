package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/stretchr/testify/assert"
)

func TestGetPanelPluginToMigrateTo(t *testing.T) {
	tests := []struct {
		name     string
		panel    map[string]interface{}
		expected string
	}{
		// Graph panel special cases
		{
			name: "graph panel with xaxis.mode=series and legend.values migrates to bargauge",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": map[string]interface{}{
					"values": true,
				},
			},
			expected: "bargauge",
		},
		{
			name: "graph panel with xaxis.mode=series and legend.values=false migrates to bargauge",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": map[string]interface{}{
					"values": false,
				},
			},
			expected: "bargauge",
		},
		{
			name: "graph panel with xaxis.mode=series but no legend.values migrates to barchart",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": map[string]interface{}{
					"show": true,
				},
			},
			expected: "barchart",
		},
		{
			name: "graph panel with xaxis.mode=series but no legend migrates to barchart",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
			},
			expected: "barchart",
		},
		{
			name: "graph panel with xaxis.mode=histogram migrates to histogram",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "histogram",
				},
			},
			expected: "histogram",
		},
		{
			name: "graph panel with no xaxis migrates to timeseries (default)",
			panel: map[string]interface{}{
				"type": "graph",
			},
			expected: "timeseries",
		},
		{
			name: "graph panel with xaxis but no mode migrates to timeseries (default)",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"show": true,
				},
			},
			expected: "timeseries",
		},
		{
			name: "graph panel with xaxis.mode=time migrates to timeseries (default)",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "time",
				},
			},
			expected: "timeseries",
		},

		// Standard auto-migration cases
		{
			name: "table-old panel migrates to table",
			panel: map[string]interface{}{
				"type": "table-old",
			},
			expected: "table",
		},
		{
			name: "singlestat panel migrates to stat",
			panel: map[string]interface{}{
				"type": "singlestat",
			},
			expected: "stat",
		},
		{
			name: "grafana-singlestat-panel migrates to stat",
			panel: map[string]interface{}{
				"type": "grafana-singlestat-panel",
			},
			expected: "stat",
		},
		{
			name: "grafana-piechart-panel migrates to piechart",
			panel: map[string]interface{}{
				"type": "grafana-piechart-panel",
			},
			expected: "piechart",
		},
		{
			name: "grafana-worldmap-panel migrates to geomap",
			panel: map[string]interface{}{
				"type": "grafana-worldmap-panel",
			},
			expected: "geomap",
		},
		{
			name: "natel-discrete-panel migrates to state-timeline",
			panel: map[string]interface{}{
				"type": "natel-discrete-panel",
			},
			expected: "state-timeline",
		},

		// No migration cases
		{
			name: "timeseries panel does not migrate",
			panel: map[string]interface{}{
				"type": "timeseries",
			},
			expected: "",
		},
		{
			name: "stat panel does not migrate",
			panel: map[string]interface{}{
				"type": "stat",
			},
			expected: "",
		},
		{
			name: "unknown panel type does not migrate",
			panel: map[string]interface{}{
				"type": "unknown-panel",
			},
			expected: "",
		},

		// Edge cases
		{
			name: "panel with no type does not migrate",
			panel: map[string]interface{}{
				"title": "Panel without type",
			},
			expected: "",
		},
		{
			name: "panel with non-string type does not migrate",
			panel: map[string]interface{}{
				"type": 123,
			},
			expected: "",
		},
		{
			name: "graph panel with invalid xaxis type still migrates to timeseries",
			panel: map[string]interface{}{
				"type":  "graph",
				"xaxis": "invalid",
			},
			expected: "timeseries",
		},
		{
			name: "graph panel with invalid legend type still migrates to barchart when xaxis.mode=series",
			panel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": "invalid",
			},
			expected: "barchart",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := schemaversion.GetPanelPluginToMigrateTo(tt.panel)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestApplyPanelTypeMigration(t *testing.T) {
	tests := []struct {
		name           string
		inputPanel     map[string]interface{}
		expectedPanel  map[string]interface{}
		expectedChange bool
	}{
		{
			name: "graph panel gets migrated with autoMigrateFrom set",
			inputPanel: map[string]interface{}{
				"type":  "graph",
				"title": "Test Graph",
				"id":    1,
			},
			expectedPanel: map[string]interface{}{
				"type":            "timeseries",
				"autoMigrateFrom": "graph",
				"title":           "Test Graph",
				"id":              1,
			},
			expectedChange: true,
		},
		{
			name: "graph panel with series mode migrates to bargauge",
			inputPanel: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": map[string]interface{}{
					"values": true,
				},
				"title": "Test Bargauge",
			},
			expectedPanel: map[string]interface{}{
				"type": "bargauge",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": map[string]interface{}{
					"values": true,
				},
				"autoMigrateFrom": "graph",
				"title":           "Test Bargauge",
			},
			expectedChange: true,
		},
		{
			name: "singlestat panel gets migrated with autoMigrateFrom set",
			inputPanel: map[string]interface{}{
				"type":  "singlestat",
				"title": "Test Singlestat",
			},
			expectedPanel: map[string]interface{}{
				"type":            "stat",
				"autoMigrateFrom": "singlestat",
				"title":           "Test Singlestat",
			},
			expectedChange: true,
		},
		{
			name: "timeseries panel does not get migrated",
			inputPanel: map[string]interface{}{
				"type":  "timeseries",
				"title": "Test Timeseries",
			},
			expectedPanel: map[string]interface{}{
				"type":  "timeseries",
				"title": "Test Timeseries",
			},
			expectedChange: false,
		},
		{
			name: "panel with no type does not get migrated",
			inputPanel: map[string]interface{}{
				"title": "Panel without type",
			},
			expectedPanel: map[string]interface{}{
				"title": "Panel without type",
			},
			expectedChange: false,
		},
		{
			name: "panel with unknown type does not get migrated",
			inputPanel: map[string]interface{}{
				"type":  "unknown-panel",
				"title": "Unknown Panel",
			},
			expectedPanel: map[string]interface{}{
				"type":  "unknown-panel",
				"title": "Unknown Panel",
			},
			expectedChange: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Deep copy the input to avoid modifying the test data
			panel := deepCopyPanel(tt.inputPanel)

			// Apply migration
			schemaversion.ApplyPanelTypeMigration(panel)

			// Verify result
			assert.Equal(t, tt.expectedPanel, panel)
		})
	}
}

// Helper function to deep copy a panel for testing
func deepCopyPanel(original map[string]interface{}) map[string]interface{} {
	copy := make(map[string]interface{})
	for k, v := range original {
		if subMap, ok := v.(map[string]interface{}); ok {
			copy[k] = deepCopyPanel(subMap)
		} else {
			copy[k] = v
		}
	}
	return copy
}

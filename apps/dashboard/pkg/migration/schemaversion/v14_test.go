package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV14(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "v14 migration converts sharedCrosshair true to graphTooltip 1",
			input: map[string]interface{}{
				"title":           "V14 Migration Test Dashboard",
				"schemaVersion":   13,
				"sharedCrosshair": true,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "CPU Usage",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V14 Migration Test Dashboard",
				"schemaVersion": 14,
				"graphTooltip":  1,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "CPU Usage",
						"id":    1,
					},
				},
			},
		},
		{
			name: "v14 migration converts sharedCrosshair false to graphTooltip 0",
			input: map[string]interface{}{
				"title":           "V14 Migration Test Dashboard",
				"schemaVersion":   13,
				"sharedCrosshair": false,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Memory Usage",
						"id":    2,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V14 Migration Test Dashboard",
				"schemaVersion": 14,
				"graphTooltip":  0,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Memory Usage",
						"id":    2,
					},
				},
			},
		},
		{
			name: "v14 migration handles missing sharedCrosshair (defaults to false/0)",
			input: map[string]interface{}{
				"title":         "V14 Migration Test Dashboard",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "table",
						"title": "Server Stats",
						"id":    3,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V14 Migration Test Dashboard",
				"schemaVersion": 14,
				"graphTooltip":  0,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "table",
						"title": "Server Stats",
						"id":    3,
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V14)
}

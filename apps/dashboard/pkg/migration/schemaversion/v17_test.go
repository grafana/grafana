package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV17(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with minSpan 8 gets converted to maxPerRow 3",
			input: map[string]interface{}{
				"title":         "V17 MinSpan to MaxPerRow Migration Test Dashboard",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"type":    "graph",
						"title":   "Test Panel",
						"minSpan": 8,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 MinSpan to MaxPerRow Migration Test Dashboard",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "graph",
						"title":     "Test Panel",
						"maxPerRow": 3,
					},
				},
			},
		},
		{
			name: "panel with minSpan 4 gets converted to maxPerRow 6",
			input: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      2,
						"type":    "singlestat",
						"title":   "Single Stat Panel",
						"minSpan": 4,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        2,
						"type":      "singlestat",
						"title":     "Single Stat Panel",
						"maxPerRow": 6,
					},
				},
			},
		},
		{
			name: "panel with minSpan 2 gets converted to maxPerRow 12",
			input: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      3,
						"type":    "graph",
						"title":   "Wide Panel",
						"minSpan": 2,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        3,
						"type":      "graph",
						"title":     "Wide Panel",
						"maxPerRow": 12,
					},
				},
			},
		},
		{
			name: "panel with minSpan 12 gets converted to maxPerRow 2",
			input: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      4,
						"type":    "graph",
						"title":   "Narrow Panel",
						"minSpan": 12,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        4,
						"type":      "graph",
						"title":     "Narrow Panel",
						"maxPerRow": 2,
					},
				},
			},
		},
		{
			name: "panel with minSpan 24 gets converted to maxPerRow 1",
			input: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      5,
						"type":    "graph",
						"title":   "Full Width Panel",
						"minSpan": 24,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        5,
						"type":      "graph",
						"title":     "Full Width Panel",
						"maxPerRow": 1,
					},
				},
			},
		},
		{
			name: "panel with minSpan 1 gets converted to maxPerRow 24",
			input: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      6,
						"type":    "graph",
						"title":   "Tiny Panel",
						"minSpan": 1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 MinSpan Migration Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        6,
						"type":      "graph",
						"title":     "Tiny Panel",
						"maxPerRow": 24,
					},
				},
			},
		},
		{
			name: "multiple panels with different minSpan values",
			input: map[string]interface{}{
				"title":         "V17 Multiple Panels Migration Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"type":    "graph",
						"title":   "Panel 1",
						"minSpan": 8,
					},
					map[string]interface{}{
						"id":      2,
						"type":    "singlestat",
						"title":   "Panel 2",
						"minSpan": 4,
					},
					map[string]interface{}{
						"id":    3,
						"type":  "table",
						"title": "Panel 3 - No minSpan",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 Multiple Panels Migration Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "graph",
						"title":     "Panel 1",
						"maxPerRow": 3,
					},
					map[string]interface{}{
						"id":        2,
						"type":      "singlestat",
						"title":     "Panel 2",
						"maxPerRow": 6,
					},
					map[string]interface{}{
						"id":    3,
						"type":  "table",
						"title": "Panel 3 - No minSpan",
					},
				},
			},
		},
		{
			name: "panel with invalid minSpan gets cleaned up",
			input: map[string]interface{}{
				"title":         "V17 Invalid MinSpan Test",
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"type":    "graph",
						"title":   "Invalid MinSpan Panel",
						"minSpan": "invalid",
					},
					map[string]interface{}{
						"id":      2,
						"type":    "graph",
						"title":   "Zero MinSpan Panel",
						"minSpan": 0,
					},
					map[string]interface{}{
						"id":      3,
						"type":    "graph",
						"title":   "Negative MinSpan Panel",
						"minSpan": -5,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V17 Invalid MinSpan Test",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "graph",
						"title": "Invalid MinSpan Panel",
					},
					map[string]interface{}{
						"id":    2,
						"type":  "graph",
						"title": "Zero MinSpan Panel",
					},
					map[string]interface{}{
						"id":    3,
						"type":  "graph",
						"title": "Negative MinSpan Panel",
					},
				},
			},
		},
		{
			name: "dashboard with no panels",
			input: map[string]interface{}{
				"title":         "V17 No Panels Test",
				"schemaVersion": 16,
			},
			expected: map[string]interface{}{
				"title":         "V17 No Panels Test",
				"schemaVersion": 17,
			},
		},
		{
			name: "dashboard with empty panels array",
			input: map[string]interface{}{
				"title":         "V17 Empty Panels Test",
				"schemaVersion": 16,
				"panels":        []interface{}{},
			},
			expected: map[string]interface{}{
				"title":         "V17 Empty Panels Test",
				"schemaVersion": 17,
				"panels":        []interface{}{},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V17)
}

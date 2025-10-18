package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV22(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "table panel styles align is set to auto",
			input: map[string]interface{}{
				"title":         "V22 Table Panel Styles Test",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "table",
						"styles": []interface{}{
							map[string]interface{}{
								"type":    "number",
								"pattern": "Time",
								"align":   "left",
							},
							map[string]interface{}{
								"type":    "string",
								"pattern": "Value",
								"align":   "right",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V22 Table Panel Styles Test",
				"schemaVersion": 22,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "table",
						"styles": []interface{}{
							map[string]interface{}{
								"type":    "number",
								"pattern": "Time",
								"align":   "auto",
							},
							map[string]interface{}{
								"type":    "string",
								"pattern": "Value",
								"align":   "auto",
							},
						},
					},
				},
			},
		},
		{
			name: "non-table panel is unchanged except schemaVersion",
			input: map[string]interface{}{
				"title":         "V22 Non-Table Panel Test",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"styles": []interface{}{
							map[string]interface{}{
								"type":    "number",
								"pattern": "Time",
								"align":   "left",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V22 Non-Table Panel Test",
				"schemaVersion": 22,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"styles": []interface{}{
							map[string]interface{}{
								"type":    "number",
								"pattern": "Time",
								"align":   "left",
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with no styles is unchanged except schemaVersion",
			input: map[string]interface{}{
				"title":         "V22 Table Panel No Styles Test",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     3,
						"type":   "table",
						"styles": []interface{}{},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V22 Table Panel No Styles Test",
				"schemaVersion": 22,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     3,
						"type":   "table",
						"styles": []interface{}{},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V22)
}

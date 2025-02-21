package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

func TestV37(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "no legend config",
			input: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"type":    "graph",
						"options": map[string]interface{}{},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type":    "graph",
						"options": map[string]interface{}{},
					},
				},
			},
		},
		{
			name: "boolean legend true",
			input: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  true,
							},
						},
					},
				},
			},
		},
		{
			name: "boolean legend false",
			input: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": false,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  false,
							},
						},
					},
				},
			},
		},
		{
			name: "hidden displayMode",
			input: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "hidden",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  false,
							},
						},
					},
				},
			},
		},
		{
			name: "showLegend false",
			input: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"showLegend": false,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  false,
							},
						},
					},
				},
			},
		},
		{
			name: "visible legend",
			input: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "table",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "table",
								"showLegend":  true,
							},
						},
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V37)
}

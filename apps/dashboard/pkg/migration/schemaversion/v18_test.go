package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV18(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "gauge panel with legacy options-gauge gets migrated to new options format",
			input: map[string]interface{}{
				"title":         "V18 Gauge Options Migration Test Dashboard",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Gauge Panel",
						"options-gauge": map[string]interface{}{
							"unit":     "ms",
							"stat":     "last",
							"decimals": 2,
							"prefix":   "Value: ",
							"suffix":   " ms",
							"thresholds": []interface{}{
								map[string]interface{}{"color": "green", "value": 0},
								map[string]interface{}{"color": "red", "value": 100},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V18 Gauge Options Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Gauge Panel",
						"options": map[string]interface{}{
							"valueOptions": map[string]interface{}{
								"unit":     "ms",
								"stat":     "last",
								"decimals": 2,
								"prefix":   "Value: ",
								"suffix":   " ms",
							},
							"thresholds": []interface{}{
								map[string]interface{}{"color": "red", "value": 100},
								map[string]interface{}{"color": "green", "value": 0},
							},
						},
					},
				},
			},
		},
		{
			name: "gauge panel with only some gauge options gets migrated correctly",
			input: map[string]interface{}{
				"title":         "V18 Partial Gauge Options Migration Test Dashboard",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Partial Gauge Panel",
						"options-gauge": map[string]interface{}{
							"unit":     "percent",
							"decimals": 1,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V18 Partial Gauge Options Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Partial Gauge Panel",
						"options": map[string]interface{}{
							"valueOptions": map[string]interface{}{
								"unit":     "percent",
								"decimals": 1,
							},
						},
					},
				},
			},
		},
		{
			name: "gauge panel with buggy options property gets cleaned up",
			input: map[string]interface{}{
				"title":         "V18 Buggy Options Cleanup Test Dashboard",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Buggy Gauge Panel",
						"options-gauge": map[string]interface{}{
							"unit":     "bytes",
							"options":  "this should be deleted",
							"stat":     "avg",
							"decimals": 0,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V18 Buggy Options Cleanup Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Buggy Gauge Panel",
						"options": map[string]interface{}{
							"valueOptions": map[string]interface{}{
								"unit":     "bytes",
								"stat":     "avg",
								"decimals": 0,
							},
						},
					},
				},
			},
		},
		{
			name: "gauge panel with additional custom properties gets migrated correctly",
			input: map[string]interface{}{
				"title":         "V18 Custom Properties Migration Test Dashboard",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Custom Gauge Panel",
						"options-gauge": map[string]interface{}{
							"unit":           "short",
							"customProperty": "customValue",
							"anotherProp":    42,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V18 Custom Properties Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "gauge",
						"title": "Custom Gauge Panel",
						"options": map[string]interface{}{
							"valueOptions": map[string]interface{}{
								"unit": "short",
							},
							"customProperty": "customValue",
							"anotherProp":    42,
						},
					},
				},
			},
		},
		{
			name: "non-gauge panel remains unchanged",
			input: map[string]interface{}{
				"title":         "V18 Non-Gauge Panel Test Dashboard",
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "graph",
						"title": "Graph Panel",
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"show": true,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V18 Non-Gauge Panel Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "graph",
						"title": "Graph Panel",
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"show": true,
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with no panels remains unchanged",
			input: map[string]interface{}{
				"title":         "V18 No Panels Test Dashboard",
				"schemaVersion": 17,
			},
			expected: map[string]interface{}{
				"title":         "V18 No Panels Test Dashboard",
				"schemaVersion": 18,
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V18)
}

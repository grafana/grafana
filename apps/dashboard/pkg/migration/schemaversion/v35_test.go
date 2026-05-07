package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV35(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "preserves x axis visibility for timeseries with hidden axes",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byType",
										"options": "time",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "custom.axisPlacement",
											"value": "auto",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "appends to existing overrides for timeseries with hidden axes",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Series A",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "color.mode",
											"value": "palette-classic",
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Series A",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "color.mode",
											"value": "palette-classic",
										},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byType",
										"options": "time",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "custom.axisPlacement",
											"value": "auto",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "does not migrate timeseries with non-hidden axis placement",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "auto",
								},
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "auto",
								},
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
		},
		{
			name: "does not migrate non-timeseries panels",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "stat",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "stat",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
		},
		{
			name: "handles missing fieldConfig gracefully",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   1,
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   1,
					},
				},
			},
		},
		{
			name: "handles missing defaults gracefully",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{},
						},
					},
				},
			},
		},
		{
			name: "handles missing custom config gracefully",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "bytes",
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "bytes",
							},
							"overrides": []interface{}{},
						},
					},
				},
			},
		},
		{
			name: "handles missing overrides array",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"axisPlacement": "hidden",
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byType",
										"options": "time",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "custom.axisPlacement",
											"value": "auto",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "handles empty panels array",
			input: map[string]interface{}{
				"panels": []interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"panels":        []interface{}{},
			},
		},
		{
			name: "handles missing panels",
			input: map[string]interface{}{
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"schemaVersion": int(35),
				"title":         "Test Dashboard",
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V35)
}

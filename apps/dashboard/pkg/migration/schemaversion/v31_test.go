package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV31(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with basic labelsToFields transformation gets merge transformation added",
			input: map[string]interface{}{
				"title":         "V31 LabelsToFields Migration Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with basic labelsToFields",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "labelsToFields",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V31 LabelsToFields Migration Test Dashboard",
				"schemaVersion": 31,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with basic labelsToFields",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "labelsToFields",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "merge",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with labelsToFields options preserved during migration",
			input: map[string]interface{}{
				"title":         "V31 LabelsToFields Options Preservation Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with labelsToFields options",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "labelsToFields",
								"options": map[string]interface{}{
									"mode":       "rows",
									"keepLabels": []interface{}{"job", "instance"},
									"valueLabel": "value",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V31 LabelsToFields Options Preservation Test Dashboard",
				"schemaVersion": 31,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with labelsToFields options",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "labelsToFields",
								"options": map[string]interface{}{
									"mode":       "rows",
									"keepLabels": []interface{}{"job", "instance"},
									"valueLabel": "value",
								},
							},
							map[string]interface{}{
								"id":      "merge",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with multiple labelsToFields transformations",
			input: map[string]interface{}{
				"title":         "V31 Multiple LabelsToFields Migration Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with multiple labelsToFields",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "organize",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "labelsToFields",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "calculateField",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id": "labelsToFields",
								"options": map[string]interface{}{
									"mode": "rows",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V31 Multiple LabelsToFields Migration Test Dashboard",
				"schemaVersion": 31,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with multiple labelsToFields",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "organize",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "labelsToFields",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "merge",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "calculateField",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id": "labelsToFields",
								"options": map[string]interface{}{
									"mode": "rows",
								},
							},
							map[string]interface{}{
								"id":      "merge",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with no transformations remains unchanged",
			input: map[string]interface{}{
				"title":         "V31 No Transformations Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with no transformations",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V31 No Transformations Test Dashboard",
				"schemaVersion": 31,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with no transformations",
						"id":    1,
					},
				},
			},
		},
		{
			name: "panel with transformations but no labelsToFields remains unchanged",
			input: map[string]interface{}{
				"title":         "V31 Other Transformations Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with other transformations",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "organize",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "reduce",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V31 Other Transformations Test Dashboard",
				"schemaVersion": 31,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with other transformations",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "organize",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id":      "reduce",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
		},
		{
			name: "nested panels in row with labelsToFields transformation",
			input: map[string]interface{}{
				"title":         "V31 Nested Panels Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with nested panels",
						"id":        1,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel with labelsToFields",
								"id":    2,
								"transformations": []interface{}{
									map[string]interface{}{
										"id":      "labelsToFields",
										"options": map[string]interface{}{},
									},
								},
							},
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel without labelsToFields",
								"id":    3,
								"transformations": []interface{}{
									map[string]interface{}{
										"id":      "organize",
										"options": map[string]interface{}{},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V31 Nested Panels Test Dashboard",
				"schemaVersion": 31,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with nested panels",
						"id":        1,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel with labelsToFields",
								"id":    2,
								"transformations": []interface{}{
									map[string]interface{}{
										"id":      "labelsToFields",
										"options": map[string]interface{}{},
									},
									map[string]interface{}{
										"id":      "merge",
										"options": map[string]interface{}{},
									},
								},
							},
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel without labelsToFields",
								"id":    3,
								"transformations": []interface{}{
									map[string]interface{}{
										"id":      "organize",
										"options": map[string]interface{}{},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with no panels",
			input: map[string]interface{}{
				"title":         "V31 No Panels Test Dashboard",
				"schemaVersion": 30,
			},
			expected: map[string]interface{}{
				"title":         "V31 No Panels Test Dashboard",
				"schemaVersion": 31,
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V31)
}

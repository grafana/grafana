package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV43(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with formatTime transformation is converted to convertFieldType",
			input: map[string]interface{}{
				"title":         "V43 FormatTime Migration Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "formatTime",
								"options": map[string]interface{}{
									"timeField":    "timestamp",
									"outputFormat": "YYYY-MM-DD",
									"timezone":     "UTC",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V43 FormatTime Migration Test Dashboard",
				"schemaVersion": 43,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "convertFieldType",
								"options": map[string]interface{}{
									"conversions": []interface{}{
										map[string]interface{}{
											"targetField":     "timestamp",
											"destinationType": "string",
											"dateFormat":      "YYYY-MM-DD",
											"timezone":        "UTC",
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
			name: "panel with minimal formatTime options",
			input: map[string]interface{}{
				"title":         "V43 Minimal FormatTime Migration Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with minimal formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "formatTime",
								"options": map[string]interface{}{
									"timeField": "time",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V43 Minimal FormatTime Migration Test Dashboard",
				"schemaVersion": 43,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with minimal formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "convertFieldType",
								"options": map[string]interface{}{
									"conversions": []interface{}{
										map[string]interface{}{
											"targetField":     "time",
											"destinationType": "string",
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
			name: "panel with empty formatTime options",
			input: map[string]interface{}{
				"title":         "V43 Empty FormatTime Migration Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with empty formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "formatTime",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V43 Empty FormatTime Migration Test Dashboard",
				"schemaVersion": 43,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with empty formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "convertFieldType",
								"options": map[string]interface{}{
									"conversions": []interface{}{
										map[string]interface{}{
											"destinationType": "string",
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
			name: "panel with multiple formatTime transformations",
			input: map[string]interface{}{
				"title":         "V43 Multiple FormatTime Migration Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with multiple formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "organize",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id": "formatTime",
								"options": map[string]interface{}{
									"timeField":    "created_at",
									"outputFormat": "MM/DD/YYYY",
									"timezone":     "America/New_York",
								},
							},
							map[string]interface{}{
								"id":      "calculateField",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id": "formatTime",
								"options": map[string]interface{}{
									"timeField":    "updated_at",
									"outputFormat": "HH:mm:ss",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V43 Multiple FormatTime Migration Test Dashboard",
				"schemaVersion": 43,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with multiple formatTime",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "organize",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id": "convertFieldType",
								"options": map[string]interface{}{
									"conversions": []interface{}{
										map[string]interface{}{
											"targetField":     "created_at",
											"destinationType": "string",
											"dateFormat":      "MM/DD/YYYY",
											"timezone":        "America/New_York",
										},
									},
								},
							},
							map[string]interface{}{
								"id":      "calculateField",
								"options": map[string]interface{}{},
							},
							map[string]interface{}{
								"id": "convertFieldType",
								"options": map[string]interface{}{
									"conversions": []interface{}{
										map[string]interface{}{
											"targetField":     "updated_at",
											"destinationType": "string",
											"dateFormat":      "HH:mm:ss",
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
			name: "panel with no transformations remains unchanged",
			input: map[string]interface{}{
				"title":         "V43 No Transformations Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with no transformations",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V43 No Transformations Test Dashboard",
				"schemaVersion": 43,
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
			name: "panel with transformations but no formatTime remains unchanged",
			input: map[string]interface{}{
				"title":         "V43 Other Transformations Test Dashboard",
				"schemaVersion": 42,
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
				"title":         "V43 Other Transformations Test Dashboard",
				"schemaVersion": 43,
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
			name: "nested panels in row with formatTime transformation",
			input: map[string]interface{}{
				"title":         "V43 Nested Panels Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with nested panels",
						"id":        1,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel with formatTime",
								"id":    2,
								"transformations": []interface{}{
									map[string]interface{}{
										"id": "formatTime",
										"options": map[string]interface{}{
											"timeField":    "timestamp",
											"outputFormat": "DD/MM/YYYY HH:mm",
											"timezone":     "Europe/London",
										},
									},
								},
							},
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel without formatTime",
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
				"title":         "V43 Nested Panels Test Dashboard",
				"schemaVersion": 43,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with nested panels",
						"id":        1,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel with formatTime",
								"id":    2,
								"transformations": []interface{}{
									map[string]interface{}{
										"id": "convertFieldType",
										"options": map[string]interface{}{
											"conversions": []interface{}{
												map[string]interface{}{
													"targetField":     "timestamp",
													"destinationType": "string",
													"dateFormat":      "DD/MM/YYYY HH:mm",
													"timezone":        "Europe/London",
												},
											},
										},
									},
								},
							},
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel without formatTime",
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
				"title":         "V43 No Panels Test Dashboard",
				"schemaVersion": 42,
			},
			expected: map[string]interface{}{
				"title":         "V43 No Panels Test Dashboard",
				"schemaVersion": 43,
			},
		},
		{
			name: "formatTime transformation without options object",
			input: map[string]interface{}{
				"title":         "V43 No Options Object Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with formatTime without options",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "formatTime",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V43 No Options Object Test Dashboard",
				"schemaVersion": 43,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with formatTime without options",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "convertFieldType",
								"options": map[string]interface{}{
									"conversions": []interface{}{
										map[string]interface{}{
											"destinationType": "string",
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V43)
}

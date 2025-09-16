package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV39(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "comprehensive timeSeriesTable transformation migration with nested panels",
			input: map[string]interface{}{
				"title":         "V39 TimeSeriesTable Transformation Migration Test Dashboard",
				"schemaVersion": 38,
				"panels": []interface{}{
					// Single stat timeSeriesTable
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable Transformation - Single Stat",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{
										"A": "mean",
									},
								},
							},
						},
					},
					// Multiple stats timeSeriesTable
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable Transformation - Multiple Stats",
						"id":    2,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{
										"A": "mean",
										"B": "max",
										"C": "min",
										"D": "sum",
									},
								},
							},
						},
					},
					// Mixed transformations
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with TimeSeriesTable Transformation - Mixed with Other Transforms",
						"id":    3,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "reduce",
								"options": map[string]interface{}{
									"reducers": []interface{}{"mean"},
								},
							},
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{
										"A": "last",
										"B": "first",
									},
								},
							},
							map[string]interface{}{
								"id": "organize",
								"options": map[string]interface{}{
									"excludeByName": map[string]interface{}{},
								},
							},
						},
					},
					// Non-timeSeriesTable transformation
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with Non-TimeSeriesTable Transformation (Should Remain Unchanged)",
						"id":    4,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "reduce",
								"options": map[string]interface{}{
									"reducers": []interface{}{"mean", "max"},
								},
							},
						},
					},
					// Empty refIdToStat
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable - Empty RefIdToStat",
						"id":    5,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{},
								},
							},
						},
					},
					// No options (should skip)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable - No Options (Should Skip)",
						"id":    6,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
							},
						},
					},
					// Invalid options (should skip)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable - Invalid Options (Should Skip)",
						"id":    7,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"someOtherOption": "value",
								},
							},
						},
					},
					// No transformations
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with No Transformations (Should Remain Unchanged)",
						"id":    8,
					},
					// Row with nested panels
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with Nested Panels Having TimeSeriesTable Transformations",
						"id":        9,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "table",
								"title": "Nested Panel with TimeSeriesTable",
								"id":    10,
								"transformations": []interface{}{
									map[string]interface{}{
										"id": "timeSeriesTable",
										"options": map[string]interface{}{
											"refIdToStat": map[string]interface{}{
												"NestedA": "median",
												"NestedB": "stdDev",
											},
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V39 TimeSeriesTable Transformation Migration Test Dashboard",
				"schemaVersion": 39,
				"panels": []interface{}{
					// Single stat timeSeriesTable (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable Transformation - Single Stat",
						"id":    1,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"A": map[string]interface{}{
										"stat": "mean",
									},
								},
							},
						},
					},
					// Multiple stats timeSeriesTable (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable Transformation - Multiple Stats",
						"id":    2,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"A": map[string]interface{}{
										"stat": "mean",
									},
									"B": map[string]interface{}{
										"stat": "max",
									},
									"C": map[string]interface{}{
										"stat": "min",
									},
									"D": map[string]interface{}{
										"stat": "sum",
									},
								},
							},
						},
					},
					// Mixed transformations (timeSeriesTable migrated, others unchanged)
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with TimeSeriesTable Transformation - Mixed with Other Transforms",
						"id":    3,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "reduce",
								"options": map[string]interface{}{
									"reducers": []interface{}{"mean"},
								},
							},
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"A": map[string]interface{}{
										"stat": "last",
									},
									"B": map[string]interface{}{
										"stat": "first",
									},
								},
							},
							map[string]interface{}{
								"id": "organize",
								"options": map[string]interface{}{
									"excludeByName": map[string]interface{}{},
								},
							},
						},
					},
					// Non-timeSeriesTable transformation (unchanged)
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with Non-TimeSeriesTable Transformation (Should Remain Unchanged)",
						"id":    4,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "reduce",
								"options": map[string]interface{}{
									"reducers": []interface{}{"mean", "max"},
								},
							},
						},
					},
					// Empty refIdToStat (migrated to empty options)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable - Empty RefIdToStat",
						"id":    5,
						"transformations": []interface{}{
							map[string]interface{}{
								"id":      "timeSeriesTable",
								"options": map[string]interface{}{},
							},
						},
					},
					// No options (unchanged - should skip)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable - No Options (Should Skip)",
						"id":    6,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
							},
						},
					},
					// Invalid options (unchanged - should skip)
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with TimeSeriesTable - Invalid Options (Should Skip)",
						"id":    7,
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"someOtherOption": "value",
								},
							},
						},
					},
					// No transformations (unchanged)
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with No Transformations (Should Remain Unchanged)",
						"id":    8,
					},
					// Row with nested panels (nested panel migrated)
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with Nested Panels Having TimeSeriesTable Transformations",
						"id":        9,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "table",
								"title": "Nested Panel with TimeSeriesTable",
								"id":    10,
								"transformations": []interface{}{
									map[string]interface{}{
										"id": "timeSeriesTable",
										"options": map[string]interface{}{
											"NestedA": map[string]interface{}{
												"stat": "median",
											},
											"NestedB": map[string]interface{}{
												"stat": "stdDev",
											},
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
	runMigrationTests(t, tests, schemaversion.V39)
}

package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV30(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with legacy value mappings gets upgraded to new format",
			input: map[string]interface{}{
				"title":         "V30 Value Mappings Migration Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with legacy value mappings",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": (*float64)(nil),
										},
										map[string]interface{}{
											"color": "red",
											"value": float64(80),
										},
									},
								},
								"mappings": []interface{}{
									map[string]interface{}{
										"id":    0,
										"text":  "Up",
										"type":  float64(1),
										"value": "1",
									},
									map[string]interface{}{
										"id":    1,
										"text":  "Down",
										"type":  float64(1),
										"value": "0",
									},
									map[string]interface{}{
										"from": "10",
										"to":   "20",
										"text": "Medium",
										"type": float64(2),
									},
									map[string]interface{}{
										"type":  float64(1),
										"value": "null",
										"text":  "Null Value",
									},
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "test-field",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "mappings",
											"value": []interface{}{
												map[string]interface{}{
													"id":    0,
													"text":  "Override Up",
													"type":  float64(1),
													"value": "1",
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
			expected: map[string]interface{}{
				"title":         "V30 Value Mappings Migration Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with legacy value mappings",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": (*float64)(nil),
										},
										map[string]interface{}{
											"color": "red",
											"value": float64(80),
										},
									},
								},
								"mappings": []interface{}{
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"1": map[string]interface{}{
												"text": "Up",
											},
											"0": map[string]interface{}{
												"text": "Down",
											},
										},
									},
									map[string]interface{}{
										"type": "range",
										"options": map[string]interface{}{
											"from": float64(10),
											"to":   float64(20),
											"result": map[string]interface{}{
												"text": "Medium",
											},
										},
									},
									map[string]interface{}{
										"type": "special",
										"options": map[string]interface{}{
											"match": "null",
											"result": map[string]interface{}{
												"text": "Null Value",
											},
										},
									},
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "test-field",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "mappings",
											"value": []interface{}{
												map[string]interface{}{
													"type": "value",
													"options": map[string]interface{}{
														"1": map[string]interface{}{
															"text": "Override Up",
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
				},
			},
		},
		{
			name: "panel with tooltip options gets migrated to tooltip",
			input: map[string]interface{}{
				"title":         "V30 Tooltip Options Migration Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with tooltipOptions",
						"id":    1,
						"options": map[string]interface{}{
							"tooltipOptions": map[string]interface{}{
								"mode": "multi",
							},
						},
					},
					map[string]interface{}{
						"type":  "xychart",
						"title": "XY Chart with tooltipOptions",
						"id":    2,
						"options": map[string]interface{}{
							"tooltipOptions": map[string]interface{}{
								"mode": "single",
							},
						},
					},
					map[string]interface{}{
						"type":  "xychart2",
						"title": "XY Chart2 with tooltipOptions",
						"id":    3,
						"options": map[string]interface{}{
							"tooltipOptions": map[string]interface{}{
								"mode": "single",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V30 Tooltip Options Migration Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with tooltipOptions",
						"id":    1,
						"options": map[string]interface{}{
							"tooltip": map[string]interface{}{
								"mode": "multi",
							},
						},
					},
					map[string]interface{}{
						"type":  "xychart",
						"title": "XY Chart with tooltipOptions",
						"id":    2,
						"options": map[string]interface{}{
							"tooltip": map[string]interface{}{
								"mode": "single",
							},
						},
					},
					map[string]interface{}{
						"type":  "xychart2",
						"title": "XY Chart2 with tooltipOptions",
						"id":    3,
						"options": map[string]interface{}{
							"tooltip": map[string]interface{}{
								"mode": "single",
							},
						},
					},
				},
			},
		},
		{
			name: "panel with nested panels in collapsed row gets migrated",
			input: map[string]interface{}{
				"title":         "V30 Nested Panels Migration Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"title":     "Collapsed Row",
						"id":        1,
						"collapsed": true,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel with tooltipOptions",
								"id":    2,
								"options": map[string]interface{}{
									"tooltipOptions": map[string]interface{}{
										"mode": "multi",
									},
								},
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"mappings": []interface{}{
											map[string]interface{}{
												"id":    0,
												"text":  "On",
												"type":  float64(1),
												"value": "1",
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
				"title":         "V30 Nested Panels Migration Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"title":     "Collapsed Row",
						"id":        1,
						"collapsed": true,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested panel with tooltipOptions",
								"id":    2,
								"options": map[string]interface{}{
									"tooltip": map[string]interface{}{
										"mode": "multi",
									},
								},
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"mappings": []interface{}{
											map[string]interface{}{
												"type": "value",
												"options": map[string]interface{}{
													"1": map[string]interface{}{
														"text": "On",
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
			},
		},
		{
			name: "panel with no mappings or tooltip options remains unchanged",
			input: map[string]interface{}{
				"title":         "V30 No Changes Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with no relevant configurations",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "bytes",
							},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V30 No Changes Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with no relevant configurations",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "bytes",
							},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
							},
						},
					},
				},
			},
		},
		{
			name: "panels remain unchanged when no V30 specific migrations apply",
			input: map[string]interface{}{
				"title":         "V30 Panel Types Unchanged Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph panel",
						"id":    1,
					},
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat panel",
						"id":    2,
					},
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Already timeseries panel",
						"id":    3,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V30 Panel Types Unchanged Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph panel",
						"id":    1,
					},
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat panel",
						"id":    2,
					},
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Already timeseries panel",
						"id":    3,
					},
				},
			},
		},
		{
			name: "already migrated value mappings are preserved correctly",
			input: map[string]interface{}{
				"title":         "V30 Already Migrated Value Mappings Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with already migrated value mappings",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"mappings": []interface{}{
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"20": map[string]interface{}{
												"color": nil,
												"text":  "test",
											},
										},
									},
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"30": map[string]interface{}{
												"color": nil,
												"text":  "test1",
											},
										},
									},
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"40": map[string]interface{}{
												"color": "orange",
												"text":  "50",
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
				"title":         "V30 Already Migrated Value Mappings Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with already migrated value mappings",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"mappings": []interface{}{
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"20": map[string]interface{}{
												"color": nil,
												"text":  "test",
											},
										},
									},
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"30": map[string]interface{}{
												"color": nil,
												"text":  "test1",
											},
										},
									},
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"40": map[string]interface{}{
												"color": "orange",
												"text":  "50",
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
		{
			name: "graph panels with different configurations remain unchanged in V30",
			input: map[string]interface{}{
				"title":         "V30 Graph Panel Configurations Test Dashboard",
				"schemaVersion": 29,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with series mode and legend values",
						"id":    1,
						"xaxis": map[string]interface{}{
							"mode": "series",
						},
						"legend": map[string]interface{}{
							"values": true,
						},
					},
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with series mode",
						"id":    2,
						"xaxis": map[string]interface{}{
							"mode": "series",
						},
					},
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with histogram mode",
						"id":    3,
						"xaxis": map[string]interface{}{
							"mode": "histogram",
						},
					},
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with default configuration",
						"id":    4,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V30 Graph Panel Configurations Test Dashboard",
				"schemaVersion": 30,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with series mode and legend values",
						"id":    1,
						"xaxis": map[string]interface{}{
							"mode": "series",
						},
						"legend": map[string]interface{}{
							"values": true,
						},
					},
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with series mode",
						"id":    2,
						"xaxis": map[string]interface{}{
							"mode": "series",
						},
					},
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with histogram mode",
						"id":    3,
						"xaxis": map[string]interface{}{
							"mode": "histogram",
						},
					},
					map[string]interface{}{
						"type":  "graph",
						"title": "Graph with default configuration",
						"id":    4,
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V30)
}

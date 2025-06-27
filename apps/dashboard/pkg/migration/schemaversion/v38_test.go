package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV38(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "table migration with nested panels",
			input: map[string]interface{}{
				"title":         "V38 Table Migration Test Dashboard",
				"schemaVersion": 37,
				"panels": []interface{}{
					// Basic gauge table
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Basic Gauge",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "basic",
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Gradient gauge table
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Gradient Gauge",
						"id":    2,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "gradient-gauge",
								},
							},
							"overrides": []interface{}{},
						},
					},
					// LCD gauge table
					map[string]interface{}{
						"type":  "table",
						"title": "Table with LCD Gauge",
						"id":    3,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "lcd-gauge",
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Color background table
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Color Background",
						"id":    4,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "color-background",
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Color background solid table
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Color Background Solid",
						"id":    5,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "color-background-solid",
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Unknown mode table
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Unknown Mode",
						"id":    6,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "some-other-mode",
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Table with no display mode
					map[string]interface{}{
						"type":  "table",
						"title": "Table with No Display Mode",
						"id":    7,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"width": 100,
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Table with overrides
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Overrides",
						"id":    8,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "basic",
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Field1",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "custom.displayMode",
											"value": "gradient-gauge",
										},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Field2",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "custom.displayMode",
											"value": "color-background",
										},
									},
								},
							},
						},
					},
					// Non-table panel (should remain unchanged)
					map[string]interface{}{
						"type":  "graph",
						"title": "Non-table Panel (Should Remain Unchanged)",
						"id":    9,
					},
					// Row with nested table panels
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with Nested Table Panels",
						"id":        10,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "table",
								"title": "Nested Table with Basic Mode",
								"id":    11,
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"custom": map[string]interface{}{
											"displayMode": "basic",
										},
									},
									"overrides": []interface{}{},
								},
							},
							map[string]interface{}{
								"type":  "table",
								"title": "Nested Table with Gradient Gauge",
								"id":    12,
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"custom": map[string]interface{}{
											"displayMode": "gradient-gauge",
										},
									},
									"overrides": []interface{}{
										map[string]interface{}{
											"matcher": map[string]interface{}{
												"id":      "byName",
												"options": "NestedField",
											},
											"properties": []interface{}{
												map[string]interface{}{
													"id":    "custom.displayMode",
													"value": "lcd-gauge",
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
				"title":         "V38 Table Migration Test Dashboard",
				"schemaVersion": 38,
				"panels": []interface{}{
					// Basic gauge table (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Basic Gauge",
						"id":    1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "basic",
									},
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Gradient gauge table (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Gradient Gauge",
						"id":    2,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "gradient",
									},
								},
							},
							"overrides": []interface{}{},
						},
					},
					// LCD gauge table (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with LCD Gauge",
						"id":    3,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "lcd",
									},
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Color background table (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Color Background",
						"id":    4,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "color-background",
										"mode": "gradient",
									},
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Color background solid table (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Color Background Solid",
						"id":    5,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "color-background",
										"mode": "basic",
									},
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Unknown mode table (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Unknown Mode",
						"id":    6,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "some-other-mode",
									},
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Table with no display mode (unchanged)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with No Display Mode",
						"id":    7,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"width": 100,
								},
							},
							"overrides": []interface{}{},
						},
					},
					// Table with overrides (migrated)
					map[string]interface{}{
						"type":  "table",
						"title": "Table with Overrides",
						"id":    8,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "basic",
									},
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Field1",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.cellOptions",
											"value": map[string]interface{}{
												"type": "gauge",
												"mode": "gradient",
											},
										},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Field2",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.cellOptions",
											"value": map[string]interface{}{
												"type": "color-background",
												"mode": "gradient",
											},
										},
									},
								},
							},
						},
					},
					// Non-table panel (unchanged)
					map[string]interface{}{
						"type":  "graph",
						"title": "Non-table Panel (Should Remain Unchanged)",
						"id":    9,
					},
					// Row with nested table panels (nested tables migrated)
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with Nested Table Panels",
						"id":        10,
						"collapsed": false,
						"panels": []interface{}{
							map[string]interface{}{
								"type":  "table",
								"title": "Nested Table with Basic Mode",
								"id":    11,
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"custom": map[string]interface{}{
											"cellOptions": map[string]interface{}{
												"type": "gauge",
												"mode": "basic",
											},
										},
									},
									"overrides": []interface{}{},
								},
							},
							map[string]interface{}{
								"type":  "table",
								"title": "Nested Table with Gradient Gauge",
								"id":    12,
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"custom": map[string]interface{}{
											"cellOptions": map[string]interface{}{
												"type": "gauge",
												"mode": "gradient",
											},
										},
									},
									"overrides": []interface{}{
										map[string]interface{}{
											"matcher": map[string]interface{}{
												"id":      "byName",
												"options": "NestedField",
											},
											"properties": []interface{}{
												map[string]interface{}{
													"id": "custom.cellOptions",
													"value": map[string]interface{}{
														"type": "gauge",
														"mode": "lcd",
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
	}
	runMigrationTests(t, tests, schemaversion.V38)
}

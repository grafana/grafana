package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV42(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "hideFrom.viz = true should also set hideFrom.tooltip = true",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Field 1",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz": true,
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
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Field 1",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz":     true,
												"tooltip": true,
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
			name: "hideFrom.viz = false should not change",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz": false,
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
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz": false,
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
			name: "multiple panels with hideFrom.viz = true",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz": true,
											},
										},
									},
								},
							},
						},
					},
					map[string]interface{}{
						"id": 2,
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz":    true,
												"legend": false,
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
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz":     true,
												"tooltip": true,
											},
										},
									},
								},
							},
						},
					},
					map[string]interface{}{
						"id": 2,
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"viz":     true,
												"legend":  false,
												"tooltip": true,
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
			name: "panel without hideFrom property",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "unit",
											"value": "short",
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"properties": []interface{}{
										map[string]interface{}{
											"id":    "unit",
											"value": "short",
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
			name: "nested panels in rows should also be migrated",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "row",
						"title": "Row 1",
						"panels": []interface{}{
							map[string]interface{}{
								"id": 2,
								"fieldConfig": map[string]interface{}{
									"overrides": []interface{}{
										map[string]interface{}{
											"properties": []interface{}{
												map[string]interface{}{
													"id": "custom.hideFrom",
													"value": map[string]interface{}{
														"viz": true,
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
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "row",
						"title": "Row 1",
						"panels": []interface{}{
							map[string]interface{}{
								"id": 2,
								"fieldConfig": map[string]interface{}{
									"overrides": []interface{}{
										map[string]interface{}{
											"properties": []interface{}{
												map[string]interface{}{
													"id": "custom.hideFrom",
													"value": map[string]interface{}{
														"viz":     true,
														"tooltip": true,
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
			name: "__systemRef override should also be migrated",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"__systemRef": "hideSeriesFrom",
									"matcher": map[string]interface{}{
										"id": "byNames",
										"options": map[string]interface{}{
											"mode":     "exclude",
											"names":    []interface{}{"foo"},
											"prefix":   "All except:",
											"readOnly": true,
										},
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"legend":  false,
												"tooltip": false,
												"viz":     true,
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
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"fieldConfig": map[string]interface{}{
							"overrides": []interface{}{
								map[string]interface{}{
									"__systemRef": "hideSeriesFrom",
									"matcher": map[string]interface{}{
										"id": "byNames",
										"options": map[string]interface{}{
											"mode":     "exclude",
											"names":    []interface{}{"foo"},
											"prefix":   "All except:",
											"readOnly": true,
										},
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "custom.hideFrom",
											"value": map[string]interface{}{
												"legend":  false,
												"tooltip": true,
												"viz":     true,
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
			name: "dashboard without panels",
			input: map[string]interface{}{
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 42,
			},
		},
		{
			name: "panel without fieldConfig",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 42,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V42)
}

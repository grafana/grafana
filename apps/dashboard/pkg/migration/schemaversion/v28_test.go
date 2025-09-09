package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV28(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "migrate angular singlestat to stat panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"type":       "singlestat",
						"valueName":  "avg",
						"format":     "ms",
						"decimals":   2,
						"thresholds": "10,20,30",
						"colors":     []interface{}{"green", "yellow", "red"},
						"gauge": map[string]interface{}{
							"show": false,
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "var1",
							"tags":           []interface{}{"tag1"},
							"tagsQuery":      "query",
							"tagValuesQuery": "values",
							"useTags":        true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"mean"},
								"fields": "",
								"values": false,
							},
							"orientation":            "horizontal",
							"colorMode":              "none",
							"graphMode":              "none",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit":     "ms",
								"decimals": 2,
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "yellow",
											"value": 10.0,
										},
										map[string]interface{}{
											"color": "red",
											"value": 20.0,
										},
									},
								},
								"mappings": []interface{}{},
							},
							"overrides": []interface{}{},
						},

						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
						},
					},
				},
			},
		},
		{
			name: "migrate angular singlestat to stat panel with gauge options",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "singlestat",
						"valueName": "current",
						"format":    "percent",
						"gauge": map[string]interface{}{
							"show":             true,
							"thresholdMarkers": true,
							"thresholdLabels":  false,
						},
						"sparkline": map[string]interface{}{
							"show":      true,
							"lineColor": "#ff0000",
						},
						"colorBackground": true,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"lastNotNull"},
								"fields": "",
								"values": false,
							},
							"orientation":            "horizontal",
							"colorMode":              "background",
							"graphMode":              "area",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "percent",
								"min":  0,
								"max":  100,
								"color": map[string]interface{}{
									"mode":       "fixed",
									"fixedColor": "#ff0000",
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate grafana-singlestat-panel to stat panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "grafana-singlestat-panel",
						"valueName": "current",
						"format":    "percent",
						"gauge": map[string]interface{}{
							"show":             true,
							"thresholdMarkers": true,
							"thresholdLabels":  false,
						},
						"sparkline": map[string]interface{}{
							"show":      true,
							"lineColor": "#ff0000",
						},
						"colorBackground": true,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"lastNotNull"},
								"fields": "",
								"values": false,
							},
							"orientation":            "auto",
							"colorMode":              "background",
							"graphMode":              "area",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "percent",
								"min":  0,
								"max":  100,
								"color": map[string]interface{}{
									"mode":       "fixed",
									"fixedColor": "#ff0000",
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate singlestat with empty thresholds to stat panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"type":       "singlestat",
						"valueName":  "min",
						"format":     "bytes",
						"thresholds": "",
						"colors":     []interface{}{"green", "red"},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"min"},
								"fields": "",
								"values": false,
							},
							"orientation":            "horizontal",
							"colorMode":              "none",
							"graphMode":              "none",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "bytes",
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80,
										},
									},
								},
								"mappings": []interface{}{},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate grafana-singlestat-panel with empty thresholds to stat panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"type":       "grafana-singlestat-panel",
						"valueName":  "max",
						"format":     "short",
						"thresholds": "",
						"colors":     []interface{}{"green", "red"},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"max"},
								"fields": "",
								"values": false,
							},
							"orientation":            "auto",
							"colorMode":              "none",
							"graphMode":              "none",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "short",
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80,
										},
									},
								},
								"mappings": []interface{}{},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate singlestat with value mappings and threshold colors",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"type":       "singlestat",
						"valueName":  "current",
						"format":     "short",
						"thresholds": "50,80",
						"colors":     []interface{}{"green", "orange", "red"},
						"valueMaps": []interface{}{
							map[string]interface{}{
								"value": "40",
								"text":  "Warning",
							},
							map[string]interface{}{
								"value": "90",
								"text":  "Critical",
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"lastNotNull"},
								"fields": "",
								"values": false,
							},
							"orientation":            "horizontal",
							"colorMode":              "none",
							"graphMode":              "none",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "short",
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "orange",
											"value": 50.0,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80.0,
										},
									},
								},
								"mappings": []interface{}{
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"40": map[string]interface{}{
												"text":  "Warning",
												"color": "green",
											},
										},
									},
									map[string]interface{}{
										"type": "value",
										"options": map[string]interface{}{
											"90": map[string]interface{}{
												"text":  "Critical",
												"color": "red",
											},
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate singlestat with invalid valueName fallback to mean",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "singlestat",
						"valueName": "invalid_reducer",
						"format":    "short",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"mean"},
								"fields": "",
								"values": false,
							},
							"orientation":            "horizontal",
							"colorMode":              "none",
							"graphMode":              "none",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "short",
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80,
										},
									},
								},
								"mappings": []interface{}{},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate grafana-singlestat-panel with invalid valueName keeps lastNotNull",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "grafana-singlestat-panel",
						"valueName": "invalid_reducer",
						"format":    "short",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "stat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs":  []string{"lastNotNull"},
								"fields": "",
								"values": false,
							},
							"orientation":            "auto",
							"colorMode":              "none",
							"graphMode":              "none",
							"justifyMode":            "auto",
							"percentChangeColorMode": "standard",
							"showPercentChange":      false,
							"textMode":               "auto",
							"wideLayout":             true,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "short",
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80,
										},
									},
								},
								"mappings": []interface{}{},
							},
							"overrides": []interface{}{},
						},
						"pluginVersion": pluginVersionForAutoMigrate,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "handle nested panels in rows",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id":        2,
								"type":      "singlestat",
								"valueName": "sum",
								"format":    "bytes",
								"targets": []interface{}{
									map[string]interface{}{"refId": "A"},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id":   2,
								"type": "stat",
								"options": map[string]interface{}{
									"reduceOptions": map[string]interface{}{
										"calcs":  []string{"sum"},
										"fields": "",
										"values": false,
									},
									"orientation":            "horizontal",
									"colorMode":              "none",
									"graphMode":              "none",
									"justifyMode":            "auto",
									"percentChangeColorMode": "standard",
									"showPercentChange":      false,
									"textMode":               "auto",
									"wideLayout":             true,
								},
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"unit": "bytes",
										"thresholds": map[string]interface{}{
											"mode": "absolute",
											"steps": []interface{}{
												map[string]interface{}{
													"color": "green",
													"value": nil,
												},
												map[string]interface{}{
													"color": "red",
													"value": 80,
												},
											},
										},
										"mappings": []interface{}{},
									},
									"overrides": []interface{}{},
								},
								"pluginVersion": pluginVersionForAutoMigrate,
								"targets": []interface{}{
									map[string]interface{}{"refId": "A"},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "remove deprecated variable properties",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "var1",
							"type":           "query",
							"tags":           []interface{}{"tag1", "tag2"},
							"tagsQuery":      "SELECT * FROM tags",
							"tagValuesQuery": "SELECT value FROM tag_values",
							"useTags":        true,
						},
						map[string]interface{}{
							"name": "var2",
							"type": "custom",
							// No deprecated properties
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
							"type": "query",
						},
						map[string]interface{}{
							"name": "var2",
							"type": "custom",
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V28)
}

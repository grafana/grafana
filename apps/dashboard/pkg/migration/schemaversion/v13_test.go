package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV13(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "graph panel with grid thresholds gets converted to timeseries with step-based thresholds",
			input: map[string]interface{}{
				"title":         "V13 Graph Panel Line Thresholds Test",
				"schemaVersion": 12,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   1,
						"grid": map[string]interface{}{
							"threshold1":      200,
							"threshold2":      400,
							"threshold1Color": "yellow",
							"threshold2Color": "red",
							"thresholdLine":   true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V13 Graph Panel Line Thresholds Test",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   1,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"color": map[string]interface{}{
									"mode": "palette-classic",
								},
								"custom": map[string]interface{}{
									"axisBorderShow":   false,
									"axisCenteredZero": false,
									"axisColorMode":    "text",
									"axisLabel":        "",
									"axisPlacement":    "auto",
									"barAlignment":     0,
									"barWidthFactor":   0.6,
									"drawStyle":        "points",
									"fillOpacity":      0,
									"gradientMode":     "none",
									"hideFrom": map[string]interface{}{
										"legend":  false,
										"tooltip": false,
										"viz":     false,
									},
									"insertNulls":       false,
									"lineInterpolation": "linear",
									"lineWidth":         1,
									"pointSize":         5,
									"scaleDistribution": map[string]interface{}{
										"type": "linear",
									},
									"showPoints": "auto",
									"spanNulls":  false,
									"stacking": map[string]interface{}{
										"group": "A",
										"mode":  "none",
									},
									"thresholdsStyle": map[string]interface{}{
										"mode": "off",
									},
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
											"value": 80.0,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"calcs":       []interface{}{},
								"displayMode": "list",
								"placement":   "bottom",
								"showLegend":  true,
							},
							"tooltip": map[string]interface{}{
								"hideZeros": false,
								"mode":      "single",
								"sort":      "none",
							},
						},
					},
				},
			},
		},
		{
			name: "graph panel with fill thresholds gets converted to timeseries with area thresholds",
			input: map[string]interface{}{
				"title":         "V13 Graph Panel Fill Thresholds Test",
				"schemaVersion": 12,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   2,
						"grid": map[string]interface{}{
							"threshold1":      100,
							"threshold2":      300,
							"threshold1Color": "green",
							"threshold2Color": "blue",
							"thresholdLine":   false,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V13 Graph Panel Fill Thresholds Test",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   2,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"color": map[string]interface{}{
									"mode": "palette-classic",
								},
								"custom": map[string]interface{}{
									"axisBorderShow":   false,
									"axisCenteredZero": false,
									"axisColorMode":    "text",
									"axisLabel":        "",
									"axisPlacement":    "auto",
									"barAlignment":     0,
									"barWidthFactor":   0.6,
									"drawStyle":        "points",
									"fillOpacity":      0,
									"gradientMode":     "none",
									"hideFrom": map[string]interface{}{
										"legend":  false,
										"tooltip": false,
										"viz":     false,
									},
									"insertNulls":       false,
									"lineInterpolation": "linear",
									"lineWidth":         1,
									"pointSize":         5,
									"scaleDistribution": map[string]interface{}{
										"type": "linear",
									},
									"showPoints": "auto",
									"spanNulls":  false,
									"stacking": map[string]interface{}{
										"group": "A",
										"mode":  "none",
									},
									"thresholdsStyle": map[string]interface{}{
										"mode": "off",
									},
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
											"value": 80.0,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"calcs":       []interface{}{},
								"displayMode": "list",
								"placement":   "bottom",
								"showLegend":  true,
							},
							"tooltip": map[string]interface{}{
								"hideZeros": false,
								"mode":      "single",
								"sort":      "none",
							},
						},
					},
				},
			},
		},
		{
			name: "graph panel with aliasColors gets converted to timeseries with field config overrides",
			input: map[string]interface{}{
				"title":         "V13 Graph Panel Alias Colors Test",
				"schemaVersion": 12,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   3,
						"aliasColors": map[string]interface{}{
							"series1": "red",
							"series2": "blue",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V13 Graph Panel Alias Colors Test",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   3,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"color": map[string]interface{}{
									"mode": "palette-classic",
								},
								"custom": map[string]interface{}{
									"axisBorderShow":   false,
									"axisCenteredZero": false,
									"axisColorMode":    "text",
									"axisLabel":        "",
									"axisPlacement":    "auto",
									"barAlignment":     0,
									"barWidthFactor":   0.6,
									"drawStyle":        "points",
									"fillOpacity":      0,
									"gradientMode":     "none",
									"hideFrom": map[string]interface{}{
										"legend":  false,
										"tooltip": false,
										"viz":     false,
									},
									"insertNulls":       false,
									"lineInterpolation": "linear",
									"lineWidth":         1,
									"pointSize":         5,
									"scaleDistribution": map[string]interface{}{
										"type": "linear",
									},
									"showPoints": "auto",
									"spanNulls":  false,
									"stacking": map[string]interface{}{
										"group": "A",
										"mode":  "none",
									},
									"thresholdsStyle": map[string]interface{}{
										"mode": "off",
									},
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
											"value": 80.0,
										},
									},
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "series1",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "color",
											"value": map[string]interface{}{
												"mode":       "fixed",
												"fixedColor": "red",
											},
										},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "series2",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "color",
											"value": map[string]interface{}{
												"mode":       "fixed",
												"fixedColor": "blue",
											},
										},
									},
								},
							},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"calcs":       []interface{}{},
								"displayMode": "list",
								"placement":   "bottom",
								"showLegend":  true,
							},
							"tooltip": map[string]interface{}{
								"hideZeros": false,
								"mode":      "single",
								"sort":      "none",
							},
						},
					},
				},
			},
		},
		{
			name: "graph panel with y-axis configuration gets converted to timeseries with field config",
			input: map[string]interface{}{
				"title":         "V13 Graph Panel Y-Axis Test",
				"schemaVersion": 12,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   4,
						"yaxes": []interface{}{
							map[string]interface{}{
								"label":    "Y-Axis Label",
								"show":     true,
								"logBase":  10.0,
								"format":   "short",
								"decimals": 2,
								"min":      0.0,
								"max":      100.0,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V13 Graph Panel Y-Axis Test",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   4,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"color": map[string]interface{}{
									"mode": "palette-classic",
								},
								"unit":     "short",
								"decimals": 2,
								"min":      0.0,
								"max":      100.0,
								"custom": map[string]interface{}{
									"axisBorderShow":   false,
									"axisCenteredZero": false,
									"axisColorMode":    "text",
									"axisLabel":        "Y-Axis Label",
									"axisPlacement":    "auto",
									"barAlignment":     0,
									"barWidthFactor":   0.6,
									"drawStyle":        "points",
									"fillOpacity":      0,
									"gradientMode":     "none",
									"hideFrom": map[string]interface{}{
										"legend":  false,
										"tooltip": false,
										"viz":     false,
									},
									"insertNulls":       false,
									"lineInterpolation": "linear",
									"lineWidth":         1,
									"pointSize":         5,
									"scaleDistribution": map[string]interface{}{
										"type": "log",
										"log":  10.0,
									},
									"showPoints": "auto",
									"spanNulls":  false,
									"stacking": map[string]interface{}{
										"group": "A",
										"mode":  "none",
									},
									"thresholdsStyle": map[string]interface{}{
										"mode": "off",
									},
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
											"value": 80.0,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"calcs":       []interface{}{},
								"displayMode": "list",
								"placement":   "bottom",
								"showLegend":  true,
							},
							"tooltip": map[string]interface{}{
								"hideZeros": false,
								"mode":      "single",
								"sort":      "none",
							},
						},
					},
				},
			},
		},
		{
			name: "non-graph panel is unchanged",
			input: map[string]interface{}{
				"title":         "V13 Non-Graph Panel Test",
				"schemaVersion": 12,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "singlestat",
						"id":   5,
						"grid": map[string]interface{}{
							"threshold1":      100,
							"threshold1Color": "red",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V13 Non-Graph Panel Test",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "singlestat",
						"id":   5,
						"grid": map[string]interface{}{
							"threshold1":      100,
							"threshold1Color": "red",
						},
					},
				},
			},
		},
		{
			name: "graph panel without grid gets converted to timeseries with basic structure",
			input: map[string]interface{}{
				"title":         "V13 Graph Panel No Grid Test",
				"schemaVersion": 12,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   6,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V13 Graph Panel No Grid Test",
				"schemaVersion": 13,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						"id":   6,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"color": map[string]interface{}{
									"mode": "palette-classic",
								},
								"custom": map[string]interface{}{
									"axisBorderShow":   false,
									"axisCenteredZero": false,
									"axisColorMode":    "text",
									"axisLabel":        "",
									"axisPlacement":    "auto",
									"barAlignment":     0,
									"barWidthFactor":   0.6,
									"drawStyle":        "points",
									"fillOpacity":      0,
									"gradientMode":     "none",
									"hideFrom": map[string]interface{}{
										"legend":  false,
										"tooltip": false,
										"viz":     false,
									},
									"insertNulls":       false,
									"lineInterpolation": "linear",
									"lineWidth":         1,
									"pointSize":         5,
									"scaleDistribution": map[string]interface{}{
										"type": "linear",
									},
									"showPoints": "auto",
									"spanNulls":  false,
									"stacking": map[string]interface{}{
										"group": "A",
										"mode":  "none",
									},
									"thresholdsStyle": map[string]interface{}{
										"mode": "off",
									},
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
											"value": 80.0,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"calcs":       []interface{}{},
								"displayMode": "list",
								"placement":   "bottom",
								"showLegend":  true,
							},
							"tooltip": map[string]interface{}{
								"hideZeros": false,
								"mode":      "single",
								"sort":      "none",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard without panels is unchanged",
			input: map[string]interface{}{
				"title":         "V13 No Panels Test",
				"schemaVersion": 12,
			},
			expected: map[string]interface{}{
				"title":         "V13 No Panels Test",
				"schemaVersion": 13,
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V13)
}

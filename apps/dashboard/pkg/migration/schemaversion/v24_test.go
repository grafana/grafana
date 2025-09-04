package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV24(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "should migrate basic Angular table with defaults",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     1,
						"type":   "table",
						"title":  "Basic Table",
						"legend": true,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20", "30"},
								"colors":     []interface{}{"red", "yellow", "green"},
								"pattern":    "/.*/",
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     1,
						"type":   "table",
						"title":  "Basic Table",
						"legend": true,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"align": "auto",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"value": nil, "color": "red"},
										map[string]interface{}{"value": float64(10), "color": "yellow"},
										map[string]interface{}{"value": float64(20), "color": "green"},
										map[string]interface{}{"value": float64(30), "color": "red"},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should migrate table with complex defaults and overrides",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    2,
						"type":  "table",
						"title": "Complex Table",
						"styles": []interface{}{
							// Default style
							map[string]interface{}{
								"pattern":    "/.*/",
								"unit":       "bytes",
								"decimals":   float64(2),
								"align":      "center",
								"colorMode":  "cell",
								"thresholds": []interface{}{"100", "500"},
								"colors":     []interface{}{"green", "yellow", "red"},
							},
							// Column-specific override with exact name
							map[string]interface{}{
								"pattern":   "Status",
								"alias":     "Current Status",
								"unit":      "short",
								"decimals":  float64(0),
								"colorMode": "value",
								"align":     "left",
							},
							// Column-specific override with regex pattern
							map[string]interface{}{
								"pattern":         "/Error.*/",
								"link":            true,
								"linkUrl":         "http://example.com/errors",
								"linkTooltip":     "View error details",
								"linkTargetBlank": true,
								"colorMode":       "row",
								"colors":          []interface{}{"red", "orange"},
							},
							// Date column
							map[string]interface{}{
								"pattern":    "Time",
								"type":       "date",
								"dateFormat": "YYYY-MM-DD HH:mm:ss",
								"alias":      "Timestamp",
							},
							// Hidden column
							map[string]interface{}{
								"pattern": "Hidden",
								"type":    "hidden",
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    2,
						"type":  "table",
						"title": "Complex Table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit":     "bytes",
								"decimals": 2,
								"custom": map[string]interface{}{
									"align": "center",
									"cellOptions": map[string]interface{}{
										"type": "color-background",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"value": nil, "color": "green"},
										map[string]interface{}{"value": float64(100), "color": "yellow"},
										map[string]interface{}{"value": float64(500), "color": "red"},
									},
								},
							},
							"overrides": []interface{}{
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Status",
									},
									"properties": []interface{}{
										map[string]interface{}{"id": "displayName", "value": "Current Status"},
										map[string]interface{}{"id": "unit", "value": "short"},
										map[string]interface{}{"id": "decimals", "value": 0},
										map[string]interface{}{"id": "custom.cellOptions", "value": map[string]interface{}{"type": "color-text"}},
										map[string]interface{}{"id": "custom.align", "value": "left"},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byRegexp",
										"options": "/Error.*/",
									},
									"properties": []interface{}{
										map[string]interface{}{
											"id": "links",
											"value": []interface{}{
												map[string]interface{}{
													"title":       "View error details",
													"url":         "http://example.com/errors",
													"targetBlank": true,
												},
											},
										},
										map[string]interface{}{"id": "custom.cellOptions", "value": map[string]interface{}{"type": "color-background"}},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Time",
									},
									"properties": []interface{}{
										map[string]interface{}{"id": "displayName", "value": "Timestamp"},
										map[string]interface{}{"id": "unit", "value": "time: YYYY-MM-DD HH:mm:ss"},
									},
								},
								map[string]interface{}{
									"matcher": map[string]interface{}{
										"id":      "byName",
										"options": "Hidden",
									},
									"properties": []interface{}{
										map[string]interface{}{"id": "custom.hideFrom.viz", "value": true},
									},
								},
							},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should migrate table with timeseries_aggregations transform",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    3,
						"type":  "table",
						"title": "Table with Aggregations",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern":  "/.*/",
								"unit":     "percent",
								"decimals": float64(1),
							},
						},
						"transform": "timeseries_aggregations",
						"columns": []interface{}{
							map[string]interface{}{"value": "avg", "text": "Average"},
							map[string]interface{}{"value": "max", "text": "Maximum"},
							map[string]interface{}{"value": "min", "text": "Minimum"},
							map[string]interface{}{"value": "total", "text": "Total"},
							map[string]interface{}{"value": "current", "text": "Current"},
							map[string]interface{}{"value": "count", "text": "Count"},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    3,
						"type":  "table",
						"title": "Table with Aggregations",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit":     "percent",
								"decimals": 1,
								"custom": map[string]interface{}{
									"align": "auto",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"color": "green"},
										map[string]interface{}{"color": "red", "value": 80},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "reduce",
								"options": map[string]interface{}{
									"reducers":         []interface{}{"mean", "max", "min", "sum", "lastNotNull", "count"},
									"includeTimeField": false,
								},
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should migrate table with timeseries_to_rows transform",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    4,
						"type":  "table",
						"title": "Table with Rows Transform",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern": "/.*/",
								"unit":    "short",
							},
						},
						"transform": "timeseries_to_rows",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    4,
						"type":  "table",
						"title": "Table with Rows Transform",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "short",
								"custom": map[string]interface{}{
									"align": "auto",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"color": "green"},
										map[string]interface{}{"color": "red", "value": 80},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "seriesToRows",
								"options": map[string]interface{}{
									"reducers": []interface{}{},
								},
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should migrate table with timeseries_to_columns transform",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    5,
						"type":  "table",
						"title": "Table with Columns Transform",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern": "/.*/",
								"unit":    "bytes",
							},
						},
						"transform": "timeseries_to_columns",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    5,
						"type":  "table",
						"title": "Table with Columns Transform",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "bytes",
								"custom": map[string]interface{}{
									"align": "auto",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"color": "green"},
										map[string]interface{}{"color": "red", "value": 80},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "seriesToColumns",
								"options": map[string]interface{}{
									"reducers": []interface{}{},
								},
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should migrate table with table merge transform",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    6,
						"type":  "table",
						"title": "Table with Merge Transform",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern": "/.*/",
								"align":   "auto",
							},
						},
						"transform": "table",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    6,
						"type":  "table",
						"title": "Table with Merge Transform",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"align": "",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"color": "green"},
										map[string]interface{}{"color": "red", "value": 80},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "merge",
								"options": map[string]interface{}{
									"reducers": []interface{}{},
								},
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should migrate table with existing transformations",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    7,
						"type":  "table",
						"title": "Table with Existing Transformations",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern": "/.*/",
								"unit":    "short",
							},
						},
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "filterFieldsByName",
								"options": map[string]interface{}{
									"include": map[string]interface{}{
										"names": []interface{}{"field1", "field2"},
									},
								},
							},
						},
						"transform": "timeseries_to_rows",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    7,
						"type":  "table",
						"title": "Table with Existing Transformations",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "short",
								"custom": map[string]interface{}{
									"align": "auto",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"color": "green"},
										map[string]interface{}{"color": "red", "value": 80},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "filterFieldsByName",
								"options": map[string]interface{}{
									"include": map[string]interface{}{
										"names": []interface{}{"field1", "field2"},
									},
								},
							},
							map[string]interface{}{
								"id": "seriesToRows",
								"options": map[string]interface{}{
									"reducers": []interface{}{},
								},
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
		{
			name: "should not migrate angular table without styles",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    8,
						"type":  "table",
						"title": "Table without styles",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    8,
						"type":  "table",
						"title": "Table without styles",
					},
				},
			},
		},
		{
			name: "should not migrate react table (table2)",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    9,
						"type":  "table",
						"table": "table2",
						"title": "React table",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern": "/.*/",
								"unit":    "short",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    9,
						"type":  "table",
						"table": "table2",
						"title": "React table",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern": "/.*/",
								"unit":    "short",
							},
						},
					},
				},
			},
		},
		{
			name: "should not migrate non-table panels",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    10,
						"type":  "graph",
						"title": "Graph panel",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
					map[string]interface{}{
						"id":    11,
						"type":  "singlestat",
						"title": "Singlestat panel",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    10,
						"type":  "graph",
						"title": "Graph panel",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
					map[string]interface{}{
						"id":    11,
						"type":  "singlestat",
						"title": "Singlestat panel",
					},
				},
			},
		},
		{
			name: "should handle mixed numeric and string thresholds",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    12,
						"type":  "table",
						"title": "Mixed threshold types",
						"styles": []interface{}{
							map[string]interface{}{
								"pattern":    "/.*/",
								"thresholds": []interface{}{10, "20", 30.5},
								"colors":     []interface{}{"green", "yellow", "orange", "red"},
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    12,
						"type":  "table",
						"title": "Mixed threshold types",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"align": "auto",
									"cellOptions": map[string]interface{}{
										"type": "auto",
									},
									"footer": map[string]interface{}{
										"reducers": []interface{}{},
									},
									"inspect": false,
								},
								"mappings": []interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"value": nil, "color": "green"},
										map[string]interface{}{"value": float64(10), "color": "yellow"},
										map[string]interface{}{"value": float64(20), "color": "orange"},
										map[string]interface{}{"value": float64(30.5), "color": "red"},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"options": map[string]interface{}{
							"cellHeight": "sm",
							"footer": map[string]interface{}{
								"countRows": false,
								"fields":    "",
								"reducer":   []interface{}{"sum"},
								"show":      false,
							},
							"showHeader": true,
						},
						"transformations": []interface{}{},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "12.2.0-pre",
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V24)
}

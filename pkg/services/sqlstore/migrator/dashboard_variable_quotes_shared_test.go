package migrator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveQuotesAroundVariableShared(t *testing.T) {
	tests := []struct {
		name         string
		sql          string
		variableName string
		expected     string
	}{
		{
			name:         "Remove double quotes around $var",
			sql:          `SELECT * FROM table WHERE col = "$myvar"`,
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name:         "Remove single quotes around $var",
			sql:          "SELECT * FROM table WHERE col = '$myvar'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name:         "Remove double quotes around ${var}",
			sql:          `SELECT * FROM table WHERE col = "${myvar}"`,
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = ${myvar}",
		},
		{
			name:         "Remove single quotes around ${var}",
			sql:          "SELECT * FROM table WHERE col = '${myvar}'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = ${myvar}",
		},
		{
			name:         "Skip formatted variables like ${var:csv}",
			sql:          "SELECT * FROM table WHERE col IN (${myvar:csv})",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col IN (${myvar:csv})",
		},
		{
			name:         "Skip formatted variables with quotes like '${var:csv}'",
			sql:          "SELECT * FROM table WHERE col IN ('${myvar:csv}')",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col IN ('${myvar:csv}')",
		},
		{
			name:         "No quotes to remove",
			sql:          "SELECT * FROM table WHERE col = $myvar",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name:         "Multiple occurrences of quoted variable",
			sql:          "SELECT * FROM table WHERE col1 = '$var' AND col2 = '$var'",
			variableName: "var",
			expected:     "SELECT * FROM table WHERE col1 = $var AND col2 = $var",
		},
		{
			name:         "Mixed quotes",
			sql:          `SELECT * FROM table WHERE col1 = '$var' AND col2 = "$var"`,
			variableName: "var",
			expected:     "SELECT * FROM table WHERE col1 = $var AND col2 = $var",
		},
		{
			name:         "Variable with underscore",
			sql:          "SELECT * FROM table WHERE col = '$my_var'",
			variableName: "my_var",
			expected:     "SELECT * FROM table WHERE col = $my_var",
		},
		{
			name:         "Different variable name - should not change",
			sql:          "SELECT * FROM table WHERE col = '$other_var'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = '$other_var'",
		},
		{
			name:         "Complex query with IN clause",
			sql:          "SELECT * FROM table WHERE col IN ('$myvar')",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col IN ($myvar)",
		},
		{
			name:         "Variable in schema.table notation",
			sql:          "SELECT * FROM '$schema'.table",
			variableName: "schema",
			expected:     "SELECT * FROM $schema.table",
		},
		{
			name:         "Variable with braces in schema notation",
			sql:          "SELECT * FROM \"${database}\".table",
			variableName: "database",
			expected:     "SELECT * FROM ${database}.table",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := removeQuotesAroundVariableShared(tt.sql, tt.variableName)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestProcessPanelMapShared(t *testing.T) {
	tests := []struct {
		name           string
		panelMap       map[string]any
		templatingList []map[string]any
		expectedModify bool
		expectedRawSql string
	}{
		{
			name: "PostgreSQL panel with repeat and multi variable - should modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name: "PostgreSQL panel with repeat and includeAll variable - should modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table WHERE col = '${myvar}'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "includeAll": true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM table WHERE col = ${myvar}",
		},
		{
			name: "Panel without repeat - should not modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "Non-PostgreSQL panel - should not modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "prometheus",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"expr": "metric{var=\"$myvar\"}",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: false,
			expectedRawSql: "",
		},
		{
			name: "Panel without datasource - should not modify",
			panelMap: map[string]any{
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "Variable not multi and not includeAll - should not modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": false, "includeAll": false},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "Repeat variable not in templating list - should not modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "othervar", "multi": true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "Multiple targets - should modify all",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM table1 WHERE col = '$myvar'",
					},
					map[string]any{
						"rawSql": "SELECT * FROM table2 WHERE col = '${myvar}'",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM table1 WHERE col = $myvar",
		},
		{
			name: "Empty rawSql - should not crash",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: false,
			expectedRawSql: "",
		},
		{
			name: "Panel with both multi and includeAll true - should modify",
			panelMap: map[string]any{
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql": "SELECT * FROM \"$myvar\".table",
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true, "includeAll": true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM $myvar.table",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := processPanelMapShared(tt.panelMap, tt.templatingList)
			assert.Equal(t, tt.expectedModify, modified)

			// Check the rawSql if targets exist
			if targets, ok := tt.panelMap["targets"].([]any); ok && len(targets) > 0 {
				if target, ok := targets[0].(map[string]any); ok {
					if rawSql, ok := target["rawSql"].(string); ok {
						assert.Equal(t, tt.expectedRawSql, rawSql)
					}
				}
			}
		})
	}
}

func TestProcessPanelMapsShared(t *testing.T) {
	tests := []struct {
		name           string
		panelsList     []any
		templatingList []map[string]any
		expectedModify bool
	}{
		{
			name: "Multiple panels - one should modify",
			panelsList: []any{
				map[string]any{
					"datasource": map[string]any{
						"type": "grafana-postgresql-datasource",
					},
					"repeat": "myvar",
					"targets": []any{
						map[string]any{
							"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
						},
					},
				},
				map[string]any{
					"datasource": map[string]any{
						"type": "prometheus",
					},
					"repeat": "myvar",
					"targets": []any{
						map[string]any{
							"expr": "metric{var=\"$myvar\"}",
						},
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: true,
		},
		{
			name: "Nested panels in row - should process recursively",
			panelsList: []any{
				map[string]any{
					"type": "row",
					"panels": []any{
						map[string]any{
							"datasource": map[string]any{
								"type": "grafana-postgresql-datasource",
							},
							"repeat": "myvar",
							"targets": []any{
								map[string]any{
									"rawSql": "SELECT * FROM table WHERE col = '$myvar'",
								},
							},
						},
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: true,
		},
		{
			name:           "Empty panels - should not crash",
			panelsList:     []any{},
			templatingList: []map[string]any{},
			expectedModify: false,
		},
		{
			name: "Multiple nested levels",
			panelsList: []any{
				map[string]any{
					"type": "row",
					"panels": []any{
						map[string]any{
							"type": "row",
							"panels": []any{
								map[string]any{
									"datasource": map[string]any{
										"type": "grafana-postgresql-datasource",
									},
									"repeat": "myvar",
									"targets": []any{
										map[string]any{
											"rawSql": "SELECT * FROM '${myvar}'.table",
										},
									},
								},
							},
						},
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "includeAll": true},
			},
			expectedModify: true,
		},
		{
			name: "No panels should modify",
			panelsList: []any{
				map[string]any{
					"datasource": map[string]any{
						"type": "prometheus",
					},
					"targets": []any{
						map[string]any{
							"expr": "metric",
						},
					},
				},
			},
			templatingList: []map[string]any{
				{"name": "myvar", "multi": true},
			},
			expectedModify: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := processPanelMapsShared(tt.panelsList, tt.templatingList)
			assert.Equal(t, tt.expectedModify, modified)
		})
	}
}

func TestExtractTemplatingListShared(t *testing.T) {
	tests := []struct {
		name     string
		data     map[string]any
		expected []map[string]any
	}{
		{
			name: "Valid templating list",
			data: map[string]any{
				"templating": map[string]any{
					"list": []any{
						map[string]any{
							"name":  "var1",
							"multi": true,
						},
						map[string]any{
							"name":       "var2",
							"includeAll": true,
						},
					},
				},
			},
			expected: []map[string]any{
				{"name": "var1", "multi": true},
				{"name": "var2", "includeAll": true},
			},
		},
		{
			name:     "No templating field",
			data:     map[string]any{},
			expected: nil,
		},
		{
			name: "Templating is not a map",
			data: map[string]any{
				"templating": "invalid",
			},
			expected: nil,
		},
		{
			name: "No list field in templating",
			data: map[string]any{
				"templating": map[string]any{},
			},
			expected: nil,
		},
		{
			name: "List is not an array",
			data: map[string]any{
				"templating": map[string]any{
					"list": "invalid",
				},
			},
			expected: nil,
		},
		{
			name: "Empty list",
			data: map[string]any{
				"templating": map[string]any{
					"list": []any{},
				},
			},
			expected: []map[string]any{},
		},
		{
			name: "List with non-map items - should skip them",
			data: map[string]any{
				"templating": map[string]any{
					"list": []any{
						map[string]any{"name": "var1"},
						"invalid",
						map[string]any{"name": "var2"},
					},
				},
			},
			expected: []map[string]any{
				{"name": "var1"},
				{"name": "var2"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractTemplatingListShared(tt.data)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestProcessDashboardOrResourceSpecShared(t *testing.T) {
	tests := []struct {
		name           string
		data           map[string]any
		expectedModify bool
		verifyFunc     func(t *testing.T, data map[string]any)
	}{
		{
			name: "Complete dashboard with modifications",
			data: map[string]any{
				"title": "Test Dashboard",
				"templating": map[string]any{
					"list": []any{
						map[string]any{
							"name":  "schema",
							"multi": true,
						},
					},
				},
				"panels": []any{
					map[string]any{
						"id": float64(1),
						"datasource": map[string]any{
							"type": "grafana-postgresql-datasource",
						},
						"repeat": "schema",
						"targets": []any{
							map[string]any{
								"rawSql": "SELECT * FROM '$schema'.table",
								"refId":  "A",
							},
						},
					},
				},
			},
			expectedModify: true,
			verifyFunc: func(t *testing.T, data map[string]any) {
				panels := data["panels"].([]any)
				panel := panels[0].(map[string]any)
				targets := panel["targets"].([]any)
				target := targets[0].(map[string]any)
				assert.Equal(t, "SELECT * FROM $schema.table", target["rawSql"])
				// Verify other fields are preserved
				assert.Equal(t, "A", target["refId"])
				assert.Equal(t, float64(1), panel["id"])
			},
		},
		{
			name: "Dashboard without panels",
			data: map[string]any{
				"title": "Test Dashboard",
				"templating": map[string]any{
					"list": []any{},
				},
			},
			expectedModify: false,
			verifyFunc:     nil,
		},
		{
			name: "Dashboard with empty panels",
			data: map[string]any{
				"templating": map[string]any{
					"list": []any{},
				},
				"panels": []any{},
			},
			expectedModify: false,
			verifyFunc:     nil,
		},
		{
			name: "Dashboard with panels but no modifications needed",
			data: map[string]any{
				"templating": map[string]any{
					"list": []any{
						map[string]any{"name": "var1", "multi": true},
					},
				},
				"panels": []any{
					map[string]any{
						"datasource": map[string]any{
							"type": "prometheus",
						},
						"targets": []any{
							map[string]any{
								"expr": "metric",
							},
						},
					},
				},
			},
			expectedModify: false,
			verifyFunc:     nil,
		},
		{
			name: "Complex nested structure",
			data: map[string]any{
				"version": float64(42),
				"templating": map[string]any{
					"list": []any{
						map[string]any{
							"name":       "database",
							"includeAll": true,
						},
						map[string]any{
							"name":  "schema",
							"multi": true,
						},
					},
				},
				"panels": []any{
					map[string]any{
						"type": "row",
						"panels": []any{
							map[string]any{
								"datasource": map[string]any{
									"type": "grafana-postgresql-datasource",
								},
								"repeat": "database",
								"targets": []any{
									map[string]any{
										"rawSql": `SELECT * FROM "$database".table`,
									},
								},
							},
							map[string]any{
								"datasource": map[string]any{
									"type": "grafana-postgresql-datasource",
								},
								"repeat": "schema",
								"targets": []any{
									map[string]any{
										"rawSql": "SELECT * FROM '${schema}'.table",
									},
								},
							},
						},
					},
				},
			},
			expectedModify: true,
			verifyFunc: func(t *testing.T, data map[string]any) {
				// Verify custom fields preserved
				assert.Equal(t, float64(42), data["version"])

				panels := data["panels"].([]any)
				rowPanel := panels[0].(map[string]any)
				nestedPanels := rowPanel["panels"].([]any)

				// First nested panel
				panel1 := nestedPanels[0].(map[string]any)
				targets1 := panel1["targets"].([]any)
				target1 := targets1[0].(map[string]any)
				assert.Equal(t, "SELECT * FROM $database.table", target1["rawSql"])

				// Second nested panel
				panel2 := nestedPanels[1].(map[string]any)
				targets2 := panel2["targets"].([]any)
				target2 := targets2[0].(map[string]any)
				assert.Equal(t, "SELECT * FROM ${schema}.table", target2["rawSql"])
			},
		},
		{
			name: "Panels is not an array",
			data: map[string]any{
				"templating": map[string]any{
					"list": []any{},
				},
				"panels": "invalid",
			},
			expectedModify: false,
			verifyFunc:     nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := ProcessDashboardOrResourceSpecShared(tt.data)
			assert.Equal(t, tt.expectedModify, modified)

			if tt.verifyFunc != nil {
				tt.verifyFunc(t, tt.data)
			}
		})
	}
}

func TestProcessDashboardOrResourceSpecShared_PreservesAllFields(t *testing.T) {
	// This test ensures that processing preserves all fields not related to rawSql
	data := map[string]any{
		"version":     float64(1),
		"title":       "My Dashboard",
		"customField": "should be preserved",
		"templating": map[string]any{
			"list": []any{
				map[string]any{
					"name":              "myvar",
					"multi":             true,
					"customVarField":    "also preserved",
					"anotherCustom":     float64(123),
					"nestedCustomField": map[string]any{"key": "value"},
				},
			},
		},
		"panels": []any{
			map[string]any{
				"id":          float64(1),
				"type":        "graph",
				"customAttr":  "preserved",
				"moreCustom":  []any{"a", "b", "c"},
				"objectField": map[string]any{"nested": "object"},
				"datasource": map[string]any{
					"type": "grafana-postgresql-datasource",
					"uid":  "my-datasource-uid",
					"name": "My PostgreSQL",
				},
				"repeat": "myvar",
				"targets": []any{
					map[string]any{
						"rawSql":       "SELECT * FROM '$myvar'.table",
						"refId":        "A",
						"format":       "table",
						"customTarget": "preserved too",
					},
				},
			},
		},
		"anotherTopLevel": map[string]any{"nested": "data"},
	}

	modified := ProcessDashboardOrResourceSpecShared(data)
	require.True(t, modified)

	// Verify all top-level fields are preserved
	assert.Equal(t, float64(1), data["version"])
	assert.Equal(t, "My Dashboard", data["title"])
	assert.Equal(t, "should be preserved", data["customField"])
	assert.Equal(t, map[string]any{"nested": "data"}, data["anotherTopLevel"])

	// Verify templating fields are preserved
	templating := data["templating"].(map[string]any)
	list := templating["list"].([]any)
	variable := list[0].(map[string]any)
	assert.Equal(t, "also preserved", variable["customVarField"])
	assert.Equal(t, float64(123), variable["anotherCustom"])
	assert.Equal(t, map[string]any{"key": "value"}, variable["nestedCustomField"])

	// Verify panel fields are preserved
	panels := data["panels"].([]any)
	panel := panels[0].(map[string]any)
	assert.Equal(t, float64(1), panel["id"])
	assert.Equal(t, "graph", panel["type"])
	assert.Equal(t, "preserved", panel["customAttr"])
	assert.Equal(t, []any{"a", "b", "c"}, panel["moreCustom"])
	assert.Equal(t, map[string]any{"nested": "object"}, panel["objectField"])

	// Verify datasource fields are preserved
	datasource := panel["datasource"].(map[string]any)
	assert.Equal(t, "my-datasource-uid", datasource["uid"])
	assert.Equal(t, "My PostgreSQL", datasource["name"])

	// Verify target fields are preserved
	targets := panel["targets"].([]any)
	target := targets[0].(map[string]any)
	assert.Equal(t, "SELECT * FROM $myvar.table", target["rawSql"]) // Modified
	assert.Equal(t, "A", target["refId"])                           // Preserved
	assert.Equal(t, "table", target["format"])                      // Preserved
	assert.Equal(t, "preserved too", target["customTarget"])        // Preserved
}

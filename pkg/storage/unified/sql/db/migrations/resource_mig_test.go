package migrations

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveQuotesAroundResourceVariable(t *testing.T) {
	tests := []struct {
		name         string
		sql          string
		variableName string
		expected     string
	}{
		{
			name:         "single quotes around $var",
			sql:          "SELECT * FROM table WHERE col = '$myvar'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name:         "single quotes around ${var}",
			sql:          "SELECT * FROM table WHERE col = '${myvar}'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = ${myvar}",
		},
		{
			name:         "double quotes around $var",
			sql:          `SELECT * FROM table WHERE col = "$myvar"`,
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name:         "double quotes around ${var}",
			sql:          `SELECT * FROM table WHERE col = "${myvar}"`,
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = ${myvar}",
		},
		{
			name:         "multiple occurrences with single quotes",
			sql:          "SELECT * FROM table WHERE col1 = '$var' AND col2 = '$var'",
			variableName: "var",
			expected:     "SELECT * FROM table WHERE col1 = $var AND col2 = $var",
		},
		{
			name:         "mixed quotes",
			sql:          `SELECT * FROM table WHERE col1 = '$var' AND col2 = "$var"`,
			variableName: "var",
			expected:     "SELECT * FROM table WHERE col1 = $var AND col2 = $var",
		},
		{
			name:         "no quotes - should not change",
			sql:          "SELECT * FROM table WHERE col = $myvar",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name:         "formatted variable with csv - should not change",
			sql:          "SELECT * FROM table WHERE col IN (${myvar:csv})",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col IN (${myvar:csv})",
		},
		{
			name:         "formatted variable with singlequote - should not change",
			sql:          "SELECT * FROM table WHERE col IN ('${myvar:singlequote}')",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col IN ('${myvar:singlequote}')",
		},
		{
			name:         "formatted variable with doublequote - should not change",
			sql:          `SELECT * FROM table WHERE col IN ("${myvar:doublequote}")`,
			variableName: "myvar",
			expected:     `SELECT * FROM table WHERE col IN ("${myvar:doublequote}")`,
		},
		{
			name:         "variable in middle of string - should not change",
			sql:          "SELECT * FROM table WHERE col = 'prefix$myvar'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = 'prefix$myvar'",
		},
		{
			name:         "variable with underscore",
			sql:          "SELECT * FROM table WHERE col = '$my_var'",
			variableName: "my_var",
			expected:     "SELECT * FROM table WHERE col = $my_var",
		},
		{
			name:         "different variable name - should not change",
			sql:          "SELECT * FROM table WHERE col = '$other_var'",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col = '$other_var'",
		},
		{
			name:         "complex query with IN clause",
			sql:          "SELECT * FROM table WHERE col IN ('$myvar')",
			variableName: "myvar",
			expected:     "SELECT * FROM table WHERE col IN ($myvar)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := removeQuotesAroundResourceVariable(tt.sql, tt.variableName)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestProcessResourcePanel(t *testing.T) {
	tests := []struct {
		name           string
		panel          resourceDashboardPanel
		templatingList []resourceTemplateVariable
		expectedModify bool
		expectedRawSql string
	}{
		{
			name: "panel with repeat and multi variable - should modify",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM table WHERE col = $myvar",
		},
		{
			name: "panel with repeat and includeAll variable - should modify",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '${myvar}'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", IncludeAll: true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM table WHERE col = ${myvar}",
		},
		{
			name: "panel without repeat - should not modify",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "panel with wrong datasource type - should not modify",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "prometheus"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "panel with nil datasource - should not modify",
			panel: resourceDashboardPanel{
				Repeat: "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "panel with variable not multi and not includeAll - should not modify",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: false, IncludeAll: false},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "panel with repeat variable not in templating list - should not modify",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "othervar", Multi: true},
			},
			expectedModify: false,
			expectedRawSql: "SELECT * FROM table WHERE col = '$myvar'",
		},
		{
			name: "panel with multiple targets - should modify all",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: "SELECT * FROM table1 WHERE col = '$myvar'"},
					{RawSql: "SELECT * FROM table2 WHERE col = '$myvar'"},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: true,
			expectedRawSql: "SELECT * FROM table1 WHERE col = $myvar",
		},
		{
			name: "panel with empty rawSql - should not crash",
			panel: resourceDashboardPanel{
				Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "myvar",
				Targets: []resourceTarget{
					{RawSql: ""},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: false,
			expectedRawSql: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := processResourcePanel(&tt.panel, tt.templatingList)
			assert.Equal(t, tt.expectedModify, modified)
			if len(tt.panel.Targets) > 0 {
				assert.Equal(t, tt.expectedRawSql, tt.panel.Targets[0].RawSql)
			}
		})
	}
}

func TestProcessResourcePanels(t *testing.T) {
	tests := []struct {
		name           string
		panels         []resourceDashboardPanel
		templatingList []resourceTemplateVariable
		expectedModify bool
	}{
		{
			name: "multiple panels - one should modify",
			panels: []resourceDashboardPanel{
				{
					Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
					Repeat:     "myvar",
					Targets: []resourceTarget{
						{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
					},
				},
				{
					Datasource: &resourceDatasource{Type: "prometheus"},
					Repeat:     "myvar",
					Targets: []resourceTarget{
						{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
					},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: true,
		},
		{
			name: "nested panels in row - should process recursively",
			panels: []resourceDashboardPanel{
				{
					Panels: []resourceDashboardPanel{
						{
							Datasource: &resourceDatasource{Type: "grafana-postgresql-datasource"},
							Repeat:     "myvar",
							Targets: []resourceTarget{
								{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
							},
						},
					},
				},
			},
			templatingList: []resourceTemplateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: true,
		},
		{
			name:           "empty panels - should not crash",
			panels:         []resourceDashboardPanel{},
			templatingList: []resourceTemplateVariable{},
			expectedModify: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := processResourcePanels(tt.panels, tt.templatingList)
			assert.Equal(t, tt.expectedModify, modified)
		})
	}
}

func TestUpdateRawSqlInPanels(t *testing.T) {
	tests := []struct {
		name           string
		originalPanels any
		modifiedPanels []resourceDashboardPanel
		expectedRawSql string
	}{
		{
			name: "update single panel target",
			originalPanels: []any{
				map[string]any{
					"id":   1,
					"type": "graph",
					"targets": []any{
						map[string]any{
							"rawSql": "OLD SQL",
							"refId":  "A",
						},
					},
				},
			},
			modifiedPanels: []resourceDashboardPanel{
				{
					Targets: []resourceTarget{
						{RawSql: "NEW SQL"},
					},
				},
			},
			expectedRawSql: "NEW SQL",
		},
		{
			name: "update nested panels in row",
			originalPanels: []any{
				map[string]any{
					"type": "row",
					"panels": []any{
						map[string]any{
							"id": 1,
							"targets": []any{
								map[string]any{
									"rawSql": "OLD SQL",
								},
							},
						},
					},
				},
			},
			modifiedPanels: []resourceDashboardPanel{
				{
					Panels: []resourceDashboardPanel{
						{
							Targets: []resourceTarget{
								{RawSql: "NEW SQL"},
							},
						},
					},
				},
			},
			expectedRawSql: "NEW SQL",
		},
		{
			name:           "invalid input - should not crash",
			originalPanels: "not an array",
			modifiedPanels: []resourceDashboardPanel{},
			expectedRawSql: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			updateRawSqlInPanels(tt.originalPanels, tt.modifiedPanels)

			if tt.expectedRawSql != "" {
				// Verify the update worked
				panelsList, ok := tt.originalPanels.([]any)
				require.True(t, ok)
				require.Greater(t, len(panelsList), 0)

				panelMap := panelsList[0].(map[string]any)

				// Check if it's a direct target or nested
				if targets, ok := panelMap["targets"]; ok {
					targetsList := targets.([]any)
					targetMap := targetsList[0].(map[string]any)
					assert.Equal(t, tt.expectedRawSql, targetMap["rawSql"])
				} else if nestedPanels, ok := panelMap["panels"]; ok {
					nestedList := nestedPanels.([]any)
					nestedPanel := nestedList[0].(map[string]any)
					targets := nestedPanel["targets"].([]any)
					targetMap := targets[0].(map[string]any)
					assert.Equal(t, tt.expectedRawSql, targetMap["rawSql"])
				}
			}
		})
	}
}

func TestFullMigrationScenario(t *testing.T) {
	// Test the complete flow from parsing JSON to modifying and serializing back
	inputJSON := `{
		"kind": "Dashboard",
		"apiVersion": "v1",
		"metadata": {
			"name": "test-dashboard"
		},
		"spec": {
			"title": "Test Dashboard",
			"templating": {
				"list": [
					{
						"name": "schema",
						"multi": true
					}
				]
			},
			"panels": [
				{
					"id": 1,
					"type": "graph",
					"datasource": {
						"type": "grafana-postgresql-datasource"
					},
					"repeat": "schema",
					"targets": [
						{
							"rawSql": "SELECT * FROM '$schema'.table",
							"refId": "A"
						}
					]
				}
			]
		}
	}`

	// Parse as generic map
	var wrapperMap map[string]any
	err := json.Unmarshal([]byte(inputJSON), &wrapperMap)
	require.NoError(t, err)

	// Get spec
	specMap := wrapperMap["spec"].(map[string]any)
	specBytes, err := json.Marshal(specMap)
	require.NoError(t, err)

	// Parse dashboard data
	var dashData resourceDashboardData
	err = json.Unmarshal(specBytes, &dashData)
	require.NoError(t, err)

	// Get templating list
	var templatingList []resourceTemplateVariable
	if dashData.Templating != nil {
		templatingList = dashData.Templating.List
	}

	// Process panels
	modified := processResourcePanels(dashData.Panels, templatingList)
	assert.True(t, modified, "Panels should be modified")

	// Update original structure
	if originalPanels, ok := specMap["panels"]; ok {
		updateRawSqlInPanels(originalPanels, dashData.Panels)
	}

	// Verify the rawSql was updated in the original map
	panels := specMap["panels"].([]any)
	panel := panels[0].(map[string]any)
	targets := panel["targets"].([]any)
	target := targets[0].(map[string]any)

	// The quotes should be removed
	assert.Equal(t, "SELECT * FROM $schema.table", target["rawSql"])

	// Verify other fields are preserved
	assert.Equal(t, "A", target["refId"])
	assert.Equal(t, float64(1), panel["id"]) // JSON numbers are float64
	assert.Equal(t, "graph", panel["type"])

	// Verify metadata is still there
	metadata := wrapperMap["metadata"].(map[string]any)
	assert.Equal(t, "test-dashboard", metadata["name"])
}

func TestMigrationWithComplexDashboard(t *testing.T) {
	// Test with a more complex dashboard structure
	inputJSON := `{
		"kind": "Dashboard",
		"spec": {
			"templating": {
				"list": [
					{
						"name": "database",
						"includeAll": true
					},
					{
						"name": "schema",
						"multi": true
					}
				]
			},
			"panels": [
				{
					"type": "row",
					"panels": [
						{
							"datasource": {
								"type": "grafana-postgresql-datasource"
							},
							"repeat": "database",
							"targets": [
								{
									"rawSql": "SELECT * FROM \"$database\".table"
								}
							]
						},
						{
							"datasource": {
								"type": "grafana-postgresql-datasource"
							},
							"repeat": "schema",
							"targets": [
								{
									"rawSql": "SELECT * FROM '${schema}'.table"
								}
							]
						}
					]
				},
				{
					"datasource": {
						"type": "prometheus"
					},
					"repeat": "database",
					"targets": [
						{
							"expr": "metric{db=\"$database\"}"
						}
					]
				}
			]
		}
	}`

	var wrapperMap map[string]any
	err := json.Unmarshal([]byte(inputJSON), &wrapperMap)
	require.NoError(t, err)

	specMap := wrapperMap["spec"].(map[string]any)
	specBytes, err := json.Marshal(specMap)
	require.NoError(t, err)

	var dashData resourceDashboardData
	err = json.Unmarshal(specBytes, &dashData)
	require.NoError(t, err)

	var templatingList []resourceTemplateVariable
	if dashData.Templating != nil {
		templatingList = dashData.Templating.List
	}

	modified := processResourcePanels(dashData.Panels, templatingList)
	assert.True(t, modified, "Panels should be modified")

	if originalPanels, ok := specMap["panels"]; ok {
		updateRawSqlInPanels(originalPanels, dashData.Panels)
	}

	// Verify nested panels in row were updated
	panels := specMap["panels"].([]any)
	rowPanel := panels[0].(map[string]any)
	nestedPanels := rowPanel["panels"].([]any)

	// First nested panel (database variable with double quotes)
	panel1 := nestedPanels[0].(map[string]any)
	targets1 := panel1["targets"].([]any)
	target1 := targets1[0].(map[string]any)
	assert.Equal(t, "SELECT * FROM $database.table", target1["rawSql"])

	// Second nested panel (schema variable with single quotes and braces)
	panel2 := nestedPanels[1].(map[string]any)
	targets2 := panel2["targets"].([]any)
	target2 := targets2[0].(map[string]any)
	assert.Equal(t, "SELECT * FROM ${schema}.table", target2["rawSql"])

	// Prometheus panel should not be modified (wrong datasource type)
	prometheusPanel := panels[1].(map[string]any)
	promTargets := prometheusPanel["targets"].([]any)
	promTarget := promTargets[0].(map[string]any)
	// Should not have rawSql, only expr, and expr should be unchanged
	assert.Equal(t, "metric{db=\"$database\"}", promTarget["expr"])
}

func TestMigrationPreservesFieldsNotInStruct(t *testing.T) {
	// Ensure migration preserves fields that aren't in our struct definition
	inputJSON := `{
		"kind": "Dashboard",
		"spec": {
			"version": 42,
			"customField": "customValue",
			"templating": {
				"list": [
					{
						"name": "myvar",
						"multi": true,
						"customTemplateField": "customValue"
					}
				]
			},
			"panels": [
				{
					"id": 1,
					"customPanelField": "preserved",
					"datasource": {
						"type": "grafana-postgresql-datasource",
						"uid": "my-uid"
					},
					"repeat": "myvar",
					"targets": [
						{
							"rawSql": "SELECT '$myvar'",
							"refId": "A",
							"customTargetField": "alsoPreserved"
						}
					]
				}
			]
		}
	}`

	var wrapperMap map[string]any
	err := json.Unmarshal([]byte(inputJSON), &wrapperMap)
	require.NoError(t, err)

	specMap := wrapperMap["spec"].(map[string]any)
	specBytes, err := json.Marshal(specMap)
	require.NoError(t, err)

	var dashData resourceDashboardData
	err = json.Unmarshal(specBytes, &dashData)
	require.NoError(t, err)

	var templatingList []resourceTemplateVariable
	if dashData.Templating != nil {
		templatingList = dashData.Templating.List
	}

	processResourcePanels(dashData.Panels, templatingList)

	if originalPanels, ok := specMap["panels"]; ok {
		updateRawSqlInPanels(originalPanels, dashData.Panels)
	}

	// Verify custom fields are preserved
	assert.Equal(t, float64(42), specMap["version"])
	assert.Equal(t, "customValue", specMap["customField"])

	panels := specMap["panels"].([]any)
	panel := panels[0].(map[string]any)
	assert.Equal(t, "preserved", panel["customPanelField"])
	assert.Equal(t, float64(1), panel["id"])

	datasource := panel["datasource"].(map[string]any)
	assert.Equal(t, "my-uid", datasource["uid"])

	targets := panel["targets"].([]any)
	target := targets[0].(map[string]any)
	assert.Equal(t, "SELECT $myvar", target["rawSql"])            // Modified
	assert.Equal(t, "A", target["refId"])                         // Preserved
	assert.Equal(t, "alsoPreserved", target["customTargetField"]) // Preserved
}

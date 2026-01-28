package migrations

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveQuotesAroundVariable(t *testing.T) {
	tests := []struct {
		name         string
		sql          string
		variableName string
		expected     string
	}{
		{
			name:         "Remove double quotes around $var",
			sql:          `SELECT COUNT("$table_columns") FROM grafana_metric LIMIT 50`,
			variableName: "table_columns",
			expected:     `SELECT COUNT($table_columns) FROM grafana_metric LIMIT 50`,
		},
		{
			name:         "Remove single quotes around $var",
			sql:          `SELECT * FROM grafana_metric WHERE hostname = '$hostnames_var' LIMIT 5`,
			variableName: "hostnames_var",
			expected:     `SELECT * FROM grafana_metric WHERE hostname = $hostnames_var LIMIT 5`,
		},
		{
			name:         "Remove double quotes around ${var}",
			sql:          `SELECT COUNT("${table_columns}") FROM grafana_metric`,
			variableName: "table_columns",
			expected:     `SELECT COUNT(${table_columns}) FROM grafana_metric`,
		},
		{
			name:         "Remove single quotes around ${var}",
			sql:          `SELECT * FROM table WHERE col = '${var_name}'`,
			variableName: "var_name",
			expected:     `SELECT * FROM table WHERE col = ${var_name}`,
		},
		{
			name:         "Skip formatted variables like ${var:csv}",
			sql:          `SELECT * FROM table WHERE col IN (${table_columns:csv})`,
			variableName: "table_columns",
			expected:     `SELECT * FROM table WHERE col IN (${table_columns:csv})`,
		},
		{
			name:         "Skip formatted variables with quotes like '${var:csv}'",
			sql:          `SELECT * FROM table WHERE col IN ('${table_columns:csv}')`,
			variableName: "table_columns",
			expected:     `SELECT * FROM table WHERE col IN ('${table_columns:csv}')`,
		},
		{
			name:         "No quotes to remove",
			sql:          `SELECT COUNT($table_columns) FROM grafana_metric`,
			variableName: "table_columns",
			expected:     `SELECT COUNT($table_columns) FROM grafana_metric`,
		},
		{
			name:         "Multiple occurrences of quoted variable",
			sql:          `SELECT "$col1", "$col1" FROM table`,
			variableName: "col1",
			expected:     `SELECT $col1, $col1 FROM table`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := removeQuotesAroundVariable(tt.sql, tt.variableName)
			if result != tt.expected {
				t.Errorf("removeQuotesAroundVariable() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestProcessPanel(t *testing.T) {
	tests := []struct {
		name           string
		panel          dashboardPanel
		templatingList []templateVariable
		expectedModify bool
		expectedRawSql string
	}{
		{
			name: "PostgreSQL panel with repeat and includeAll=true should be modified",
			panel: dashboardPanel{
				Datasource: &datasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "table_columns",
				Targets: []target{
					{RawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`},
				},
			},
			templatingList: []templateVariable{
				{Name: "table_columns", IncludeAll: true},
			},
			expectedModify: true,
			expectedRawSql: `SELECT COUNT($table_columns) FROM grafana_metric`,
		},
		{
			name: "PostgreSQL panel with repeat but includeAll=false should not be modified",
			panel: dashboardPanel{
				Datasource: &datasource{Type: "grafana-postgresql-datasource"},
				Repeat:     "table_columns",
				Targets: []target{
					{RawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`},
				},
			},
			templatingList: []templateVariable{
				{Name: "table_columns", IncludeAll: false},
			},
			expectedModify: false,
			expectedRawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`,
		},
		{
			name: "Non-PostgreSQL panel should not be modified",
			panel: dashboardPanel{
				Datasource: &datasource{Type: "grafana-mysql-datasource"},
				Repeat:     "table_columns",
				Targets: []target{
					{RawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`},
				},
			},
			templatingList: []templateVariable{
				{Name: "table_columns", IncludeAll: true},
			},
			expectedModify: false,
			expectedRawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`,
		},
		{
			name: "Panel without repeat should not be modified",
			panel: dashboardPanel{
				Datasource: &datasource{Type: "grafana-postgresql-datasource"},
				Targets: []target{
					{RawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`},
				},
			},
			templatingList: []templateVariable{
				{Name: "table_columns", IncludeAll: true},
			},
			expectedModify: false,
			expectedRawSql: `SELECT COUNT("$table_columns") FROM grafana_metric`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := processPanel(&tt.panel, tt.templatingList)
			if modified != tt.expectedModify {
				t.Errorf("processPanel() modified = %v, want %v", modified, tt.expectedModify)
			}
			if len(tt.panel.Targets) > 0 && tt.panel.Targets[0].RawSql != tt.expectedRawSql {
				t.Errorf("processPanel() rawSql = %q, want %q", tt.panel.Targets[0].RawSql, tt.expectedRawSql)
			}
		})
	}
}

func TestProcessPanels(t *testing.T) {
	tests := []struct {
		name           string
		panels         []dashboardPanel
		templatingList []templateVariable
		expectedModify bool
	}{
		{
			name: "multiple panels - one should modify",
			panels: []dashboardPanel{
				{
					Datasource: &datasource{Type: "grafana-postgresql-datasource"},
					Repeat:     "myvar",
					Targets: []target{
						{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
					},
				},
				{
					Datasource: &datasource{Type: "prometheus"},
					Repeat:     "myvar",
					Targets: []target{
						{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
					},
				},
			},
			templatingList: []templateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: true,
		},
		{
			name: "nested panels in row - should process recursively",
			panels: []dashboardPanel{
				{
					Panels: []dashboardPanel{
						{
							Datasource: &datasource{Type: "grafana-postgresql-datasource"},
							Repeat:     "myvar",
							Targets: []target{
								{RawSql: "SELECT * FROM table WHERE col = '$myvar'"},
							},
						},
					},
				},
			},
			templatingList: []templateVariable{
				{Name: "myvar", Multi: true},
			},
			expectedModify: true,
		},
		{
			name:           "empty panels - should not crash",
			panels:         []dashboardPanel{},
			templatingList: []templateVariable{},
			expectedModify: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified := processPanels(tt.panels, tt.templatingList)
			assert.Equal(t, tt.expectedModify, modified)
		})
	}
}

func TestUpdateRawSqlInPanels(t *testing.T) {
	tests := []struct {
		name           string
		originalPanels any
		modifiedPanels []dashboardPanel
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
			modifiedPanels: []dashboardPanel{
				{
					Targets: []target{
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
			modifiedPanels: []dashboardPanel{
				{
					Panels: []dashboardPanel{
						{
							Targets: []target{
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
			modifiedPanels: []dashboardPanel{},
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

func TestDashboardMigrationPreservesFields(t *testing.T) {
	// Test the complete flow from parsing JSON to modifying and serializing back
	inputJSON := `{
		"id": 1,
		"uid": "test-uid",
		"title": "Test Dashboard",
		"version": 42,
		"customField": "customValue",
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
				"customPanelField": "preserved",
				"datasource": {
					"type": "grafana-postgresql-datasource",
					"uid": "my-uid"
				},
				"repeat": "schema",
				"targets": [
					{
						"rawSql": "SELECT * FROM '$schema'.table",
						"refId": "A",
						"customTargetField": "alsoPreserved"
					}
				]
			}
		]
	}`

	// Parse as generic map
	var dashboardMap map[string]any
	err := json.Unmarshal([]byte(inputJSON), &dashboardMap)
	require.NoError(t, err)

	// Marshal to our struct for processing
	dashBytes, err := json.Marshal(dashboardMap)
	require.NoError(t, err)

	var dashData dashboardData
	err = json.Unmarshal(dashBytes, &dashData)
	require.NoError(t, err)

	// Get templating list
	var templatingList []templateVariable
	if dashData.Templating != nil {
		templatingList = dashData.Templating.List
	}

	// Process panels
	modified := processPanels(dashData.Panels, templatingList)
	assert.True(t, modified, "Panels should be modified")

	// Update original structure
	if originalPanels, ok := dashboardMap["panels"]; ok {
		updateRawSqlInPanels(originalPanels, dashData.Panels)
	}

	// Verify the rawSql was updated in the original map
	panels := dashboardMap["panels"].([]any)
	panel := panels[0].(map[string]any)
	targets := panel["targets"].([]any)
	target := targets[0].(map[string]any)

	// The quotes should be removed
	assert.Equal(t, "SELECT * FROM $schema.table", target["rawSql"])

	// Verify other fields are preserved
	assert.Equal(t, "A", target["refId"])
	assert.Equal(t, "alsoPreserved", target["customTargetField"])
	assert.Equal(t, float64(1), panel["id"]) // JSON numbers are float64
	assert.Equal(t, "graph", panel["type"])
	assert.Equal(t, "preserved", panel["customPanelField"])

	datasource := panel["datasource"].(map[string]any)
	assert.Equal(t, "my-uid", datasource["uid"])

	// Verify root level fields are preserved
	assert.Equal(t, float64(1), dashboardMap["id"])
	assert.Equal(t, "test-uid", dashboardMap["uid"])
	assert.Equal(t, "Test Dashboard", dashboardMap["title"])
	assert.Equal(t, float64(42), dashboardMap["version"])
	assert.Equal(t, "customValue", dashboardMap["customField"])
}

func TestDashboardMigrationWithComplexStructure(t *testing.T) {
	// Test with a more complex dashboard structure
	inputJSON := `{
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
	}`

	var dashboardMap map[string]any
	err := json.Unmarshal([]byte(inputJSON), &dashboardMap)
	require.NoError(t, err)

	dashBytes, err := json.Marshal(dashboardMap)
	require.NoError(t, err)

	var dashData dashboardData
	err = json.Unmarshal(dashBytes, &dashData)
	require.NoError(t, err)

	var templatingList []templateVariable
	if dashData.Templating != nil {
		templatingList = dashData.Templating.List
	}

	modified := processPanels(dashData.Panels, templatingList)
	assert.True(t, modified, "Panels should be modified")

	if originalPanels, ok := dashboardMap["panels"]; ok {
		updateRawSqlInPanels(originalPanels, dashData.Panels)
	}

	// Verify nested panels in row were updated
	panels := dashboardMap["panels"].([]any)
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

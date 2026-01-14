package validator

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Note: extractQueryText() uses a hardcoded field priority list because
// Grafana doesn't expose datasource query schemas at runtime.
// When Grafana adds new datasource types, update the list in dashboard.go
// and add corresponding test cases here.

// =============================================================================
// Category 1: extractQueryText Tests
// Tests verify the hardcoded field priority list works correctly.
// =============================================================================

func TestExtractQueryText(t *testing.T) {
	tests := []struct {
		name     string
		target   map[string]interface{}
		expected string
	}{
		{
			name: "prometheus_expr_field",
			target: map[string]interface{}{
				"expr": "up",
			},
			expected: "up",
		},
		{
			name: "mysql_rawSql_field",
			target: map[string]interface{}{
				"rawSql": "SELECT * FROM users LIMIT 100",
			},
			expected: "SELECT * FROM users LIMIT 100",
		},
		{
			name: "generic_query_field",
			target: map[string]interface{}{
				"query": "show measurements",
			},
			expected: "show measurements",
		},
		{
			name: "field_priority_order",
			target: map[string]interface{}{
				"expr":  "rate(cpu[5m])", // First priority
				"query": "show metrics",  // Second priority
			},
			expected: "rate(cpu[5m])", // Should return expr, not query
		},
		{
			name:     "missing_query_fields",
			target:   map[string]interface{}{"refId": "A", "hide": false},
			expected: "",
		},
		{
			name: "empty_string_value",
			target: map[string]interface{}{
				"expr": "",
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractQueryText(tt.target)
			require.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// Category 2: getDatasourceUIDFromValue Tests (4 tests)
// =============================================================================

func TestGetDatasourceUIDFromValue(t *testing.T) {
	tests := []struct {
		name     string
		value    interface{}
		expected string
	}{
		{
			name:     "string_datasource_uid",
			value:    "prom-123",
			expected: "prom-123",
		},
		{
			name: "object_datasource_with_uid",
			value: map[string]interface{}{
				"uid":  "prom-123",
				"type": "prometheus",
			},
			expected: "prom-123",
		},
		{
			name:     "variable_reference_passed_through",
			value:    "${DS_PROMETHEUS}",
			expected: "${DS_PROMETHEUS}",
		},
		{
			name:     "nil_value",
			value:    nil,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getDatasourceUIDFromValue(tt.value)
			require.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// Category 3: extractDatasourceUID Tests (5 tests)
// =============================================================================

func TestExtractDatasourceUID(t *testing.T) {
	tests := []struct {
		name     string
		target   map[string]interface{}
		panel    map[string]interface{}
		expected string
	}{
		{
			name: "target_level_datasource_string",
			target: map[string]interface{}{
				"datasource": "target-ds-123",
			},
			panel:    map[string]interface{}{},
			expected: "target-ds-123",
		},
		{
			name: "target_level_datasource_object",
			target: map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":  "target-ds-456",
					"type": "prometheus",
				},
			},
			panel:    map[string]interface{}{},
			expected: "target-ds-456",
		},
		{
			name:   "panel_level_fallback",
			target: map[string]interface{}{},
			panel: map[string]interface{}{
				"datasource": "panel-ds-789",
			},
			expected: "panel-ds-789",
		},
		{
			name: "target_level_takes_precedence",
			target: map[string]interface{}{
				"datasource": "target-ds",
			},
			panel: map[string]interface{}{
				"datasource": "panel-ds",
			},
			expected: "target-ds",
		},
		{
			name:     "both_missing_returns_empty",
			target:   map[string]interface{}{},
			panel:    map[string]interface{}{},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractDatasourceUID(tt.target, tt.panel)
			require.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// Category 4: extractQueriesFromPanel Tests (8 tests)
// =============================================================================

func TestExtractQueriesFromPanel(t *testing.T) {
	tests := []struct {
		name     string
		panel    map[string]interface{}
		expected []DashboardQuery
	}{
		{
			name: "panel_with_single_target",
			panel: map[string]interface{}{
				"id":    42,
				"title": "CPU Usage",
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "A",
						"expr":       "rate(cpu[5m])",
						"datasource": "prom-main",
					},
				},
			},
			expected: []DashboardQuery{
				{
					DatasourceUID: "prom-main",
					RefID:         "A",
					QueryText:     "rate(cpu[5m])",
					PanelTitle:    "CPU Usage",
					PanelID:       42,
				},
			},
		},
		{
			name: "panel_with_multiple_targets",
			panel: map[string]interface{}{
				"id":    10,
				"title": "Metrics",
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "A",
						"expr":       "up",
						"datasource": "prom-1",
					},
					map[string]interface{}{
						"refId":      "B",
						"expr":       "down",
						"datasource": "prom-1",
					},
				},
			},
			expected: []DashboardQuery{
				{
					DatasourceUID: "prom-1",
					RefID:         "A",
					QueryText:     "up",
					PanelTitle:    "Metrics",
					PanelID:       10,
				},
				{
					DatasourceUID: "prom-1",
					RefID:         "B",
					QueryText:     "down",
					PanelTitle:    "Metrics",
					PanelID:       10,
				},
			},
		},
		{
			name: "panel_with_no_targets_field",
			panel: map[string]interface{}{
				"id":    1,
				"title": "Text Panel",
			},
			expected: []DashboardQuery{},
		},
		{
			name: "panel_with_empty_targets_array",
			panel: map[string]interface{}{
				"id":      2,
				"title":   "Empty",
				"targets": []interface{}{},
			},
			expected: []DashboardQuery{},
		},
		{
			name: "target_missing_datasource_skipped",
			panel: map[string]interface{}{
				"id":    3,
				"title": "Incomplete",
				"targets": []interface{}{
					map[string]interface{}{
						"refId": "A",
						"expr":  "up",
						// No datasource field
					},
				},
			},
			expected: []DashboardQuery{}, // Empty because no datasource
		},
		{
			name: "target_missing_query_text_skipped",
			panel: map[string]interface{}{
				"id":    4,
				"title": "No Query",
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "A",
						"datasource": "prom-1",
						// No expr/query field
					},
				},
			},
			expected: []DashboardQuery{}, // Empty because no query text
		},
		{
			name: "panel_metadata_extraction",
			panel: map[string]interface{}{
				"id":    999,
				"title": "Custom Title",
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "Z",
						"expr":       "test_metric",
						"datasource": "ds-abc",
					},
				},
			},
			expected: []DashboardQuery{
				{
					DatasourceUID: "ds-abc",
					RefID:         "Z",
					QueryText:     "test_metric",
					PanelTitle:    "Custom Title",
					PanelID:       999,
				},
			},
		},
		{
			name: "panel_id_as_float64",
			panel: map[string]interface{}{
				"id":    float64(123), // JSON numbers parse as float64
				"title": "Float ID Panel",
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "A",
						"expr":       "metric",
						"datasource": "ds-1",
					},
				},
			},
			expected: []DashboardQuery{
				{
					DatasourceUID: "ds-1",
					RefID:         "A",
					QueryText:     "metric",
					PanelTitle:    "Float ID Panel",
					PanelID:       123,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractQueriesFromPanel(tt.panel)
			if len(tt.expected) == 0 {
				require.Empty(t, result)
			} else {
				require.Equal(t, tt.expected, result)
			}
		})
	}
}

// =============================================================================
// Category 5: Helper Functions Tests
// =============================================================================

func TestGetStringValue(t *testing.T) {
	tests := []struct {
		name         string
		m            map[string]interface{}
		key          string
		defaultValue string
		expected     string
	}{
		{
			name:         "returns_value_if_exists",
			m:            map[string]interface{}{"name": "test"},
			key:          "name",
			defaultValue: "default",
			expected:     "test",
		},
		{
			name:         "returns_default_if_missing",
			m:            map[string]interface{}{"other": "value"},
			key:          "name",
			defaultValue: "default",
			expected:     "default",
		},
		{
			name:         "handles_non_string_type",
			m:            map[string]interface{}{"name": 123},
			key:          "name",
			defaultValue: "default",
			expected:     "default",
		},
		{
			name:         "empty_map_returns_default",
			m:            map[string]interface{}{},
			key:          "name",
			defaultValue: "default",
			expected:     "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getStringValue(tt.m, tt.key, tt.defaultValue)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestGetIntValue(t *testing.T) {
	tests := []struct {
		name         string
		m            map[string]interface{}
		key          string
		defaultValue int
		expected     int
	}{
		{
			name:         "returns_int_value",
			m:            map[string]interface{}{"count": 42},
			key:          "count",
			defaultValue: 0,
			expected:     42,
		},
		{
			name:         "handles_float64_conversion",
			m:            map[string]interface{}{"count": float64(123)},
			key:          "count",
			defaultValue: 0,
			expected:     123,
		},
		{
			name:         "handles_int64_conversion",
			m:            map[string]interface{}{"count": int64(456)},
			key:          "count",
			defaultValue: 0,
			expected:     456,
		},
		{
			name:         "returns_default_for_missing",
			m:            map[string]interface{}{},
			key:          "count",
			defaultValue: 99,
			expected:     99,
		},
		{
			name:         "returns_default_for_invalid_type",
			m:            map[string]interface{}{"count": "not a number"},
			key:          "count",
			defaultValue: 99,
			expected:     99,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getIntValue(tt.m, tt.key, tt.defaultValue)
			require.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// Category 6: Integration Tests
// Real-world dashboard panel structures
// =============================================================================

func TestRealisticPrometheusPanel(t *testing.T) {
	// Realistic Prometheus panel from actual Grafana dashboard
	panel := map[string]interface{}{
		"datasource": map[string]interface{}{
			"type": "prometheus",
			"uid":  "prometheus-main",
		},
		"gridPos": map[string]interface{}{
			"h": 8,
			"w": 12,
			"x": 0,
			"y": 0,
		},
		"id":    28,
		"title": "Request Rate",
		"type":  "timeseries",
		"targets": []interface{}{
			map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "prometheus",
					"uid":  "prometheus-main",
				},
				"expr":         "rate(http_requests_total{job=\"api\"}[5m])",
				"refId":        "A",
				"legendFormat": "{{method}} {{status}}",
				"interval":     "",
			},
			map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "prometheus",
					"uid":  "prometheus-main",
				},
				"expr":         "rate(http_requests_total{job=\"worker\"}[5m])",
				"refId":        "B",
				"legendFormat": "{{method}}",
			},
		},
	}

	result := extractQueriesFromPanel(panel)

	require.Len(t, result, 2)
	require.Equal(t, "prometheus-main", result[0].DatasourceUID)
	require.Equal(t, "A", result[0].RefID)
	require.Equal(t, "rate(http_requests_total{job=\"api\"}[5m])", result[0].QueryText)
	require.Equal(t, "Request Rate", result[0].PanelTitle)
	require.Equal(t, 28, result[0].PanelID)

	require.Equal(t, "prometheus-main", result[1].DatasourceUID)
	require.Equal(t, "B", result[1].RefID)
	require.Equal(t, "rate(http_requests_total{job=\"worker\"}[5m])", result[1].QueryText)
}

func TestRealisticMySQLPanel(t *testing.T) {
	// Realistic MySQL panel structure
	panel := map[string]interface{}{
		"id":    10,
		"title": "Recent Users",
		"type":  "table",
		"datasource": map[string]interface{}{
			"type": "mysql",
			"uid":  "mysql-prod",
		},
		"targets": []interface{}{
			map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "mysql",
					"uid":  "mysql-prod",
				},
				"refId":  "A",
				"rawSql": "SELECT id, username, email FROM users WHERE created_at > NOW() - INTERVAL 1 DAY ORDER BY created_at DESC LIMIT 100",
				"format": "table",
			},
		},
	}

	result := extractQueriesFromPanel(panel)

	require.Len(t, result, 1)
	require.Equal(t, "mysql-prod", result[0].DatasourceUID)
	require.Equal(t, "A", result[0].RefID)
	require.Contains(t, result[0].QueryText, "SELECT id, username, email FROM users")
	require.Equal(t, "Recent Users", result[0].PanelTitle)
	require.Equal(t, 10, result[0].PanelID)
}

func TestMixedDatasourcesPanel(t *testing.T) {
	// Panel with targets using different datasource types
	panel := map[string]interface{}{
		"id":    50,
		"title": "Mixed Data",
		"datasource": map[string]interface{}{
			"type": "prometheus",
			"uid":  "default-prom",
		},
		"targets": []interface{}{
			map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "prometheus",
					"uid":  "prom-1",
				},
				"refId": "A",
				"expr":  "up",
			},
			map[string]interface{}{
				"datasource": map[string]interface{}{
					"type": "elasticsearch",
					"uid":  "elastic-1",
				},
				"refId": "B",
				"query": "status:200",
			},
			map[string]interface{}{
				// Uses panel-level datasource (fallback)
				"refId": "C",
				"expr":  "down",
			},
		},
	}

	result := extractQueriesFromPanel(panel)

	require.Len(t, result, 3)

	// Prometheus query
	require.Equal(t, "prom-1", result[0].DatasourceUID)
	require.Equal(t, "A", result[0].RefID)
	require.Equal(t, "up", result[0].QueryText)

	// Elasticsearch query
	require.Equal(t, "elastic-1", result[1].DatasourceUID)
	require.Equal(t, "B", result[1].RefID)
	require.Equal(t, "status:200", result[1].QueryText)

	// Query with panel-level datasource fallback
	require.Equal(t, "default-prom", result[2].DatasourceUID)
	require.Equal(t, "C", result[2].RefID)
	require.Equal(t, "down", result[2].QueryText)
}

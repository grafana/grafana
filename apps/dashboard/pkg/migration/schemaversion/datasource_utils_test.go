package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/stretchr/testify/assert"
)

func TestGetDataSourceRef(t *testing.T) {
	tests := []struct {
		name     string
		input    *schemaversion.DataSourceInfo
		expected map[string]interface{}
	}{
		{
			name:     "nil datasource should return nil",
			input:    nil,
			expected: nil,
		},
		{
			name: "datasource without apiVersion",
			input: &schemaversion.DataSourceInfo{
				UID:  "test-uid",
				Type: "prometheus",
				Name: "Test DS",
			},
			expected: map[string]interface{}{
				"uid":  "test-uid",
				"type": "prometheus",
			},
		},
		{
			name: "datasource with apiVersion",
			input: &schemaversion.DataSourceInfo{
				UID:        "test-uid",
				Type:       "elasticsearch",
				Name:       "Test ES",
				APIVersion: "v2",
			},
			expected: map[string]interface{}{
				"uid":        "test-uid",
				"type":       "elasticsearch",
				"apiVersion": "v2",
			},
		},
		{
			name: "datasource with empty apiVersion",
			input: &schemaversion.DataSourceInfo{
				UID:        "test-uid",
				Type:       "prometheus",
				Name:       "Test",
				APIVersion: "",
			},
			expected: map[string]interface{}{
				"uid":  "test-uid",
				"type": "prometheus",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := schemaversion.GetDataSourceRef(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetDefaultDSInstanceSettings(t *testing.T) {
	tests := []struct {
		name        string
		datasources []schemaversion.DataSourceInfo
		expected    *schemaversion.DataSourceInfo
	}{
		{
			name:        "empty datasources list",
			datasources: []schemaversion.DataSourceInfo{},
			expected:    nil,
		},
		{
			name: "no default datasource",
			datasources: []schemaversion.DataSourceInfo{
				{UID: "existing-ref-uid", Type: "prometheus", Name: "Existing Ref Name", Default: false},
				{UID: "existing-target-uid", Type: "elasticsearch", Name: "Existing Target Name", Default: false},
			},
			expected: nil,
		},
		{
			name: "single default datasource",
			datasources: []schemaversion.DataSourceInfo{
				{UID: "existing-ref-uid", Type: "prometheus", Name: "Existing Ref Name", Default: false},
				{UID: "default-ds-uid", Type: "prometheus", Name: "Default Test Datasource Name", Default: true, APIVersion: "v1"},
				{UID: "existing-target-uid", Type: "elasticsearch", Name: "Existing Target Name", Default: false},
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds-uid",
				Type:       "prometheus",
				Name:       "Default Test Datasource Name",
				APIVersion: "v1",
			},
		},
		{
			name: "multiple default datasources returns first",
			datasources: []schemaversion.DataSourceInfo{
				{UID: "first-default", Type: "prometheus", Name: "First Default", Default: true, APIVersion: "v1"},
				{UID: "second-default", Type: "elasticsearch", Name: "Second Default", Default: true, APIVersion: "v2"},
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "first-default",
				Type:       "prometheus",
				Name:       "First Default",
				APIVersion: "v1",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := schemaversion.GetDefaultDSInstanceSettings(tt.datasources)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetInstanceSettings(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "default-ds-uid", Type: "prometheus", Name: "Default Test Datasource Name", Default: true, APIVersion: "v1"},
		{UID: "existing-target-uid", Type: "elasticsearch", Name: "Existing Target Name", Default: false, APIVersion: "v2"},
		{UID: "existing-ref-uid", Type: "prometheus", Name: "Existing Ref Name", Default: false, APIVersion: "v1"},
	}

	tests := []struct {
		name      string
		nameOrRef interface{}
		expected  *schemaversion.DataSourceInfo
	}{
		{
			name:      "nil should return default",
			nameOrRef: nil,
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds-uid",
				Type:       "prometheus",
				Name:       "Default Test Datasource Name",
				APIVersion: "v1",
			},
		},
		{
			name:      "default string should return default",
			nameOrRef: "default",
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds-uid",
				Type:       "prometheus",
				Name:       "Default Test Datasource Name",
				APIVersion: "v1",
			},
		},
		{
			name:      "lookup by UID",
			nameOrRef: "existing-target-uid",
			expected: &schemaversion.DataSourceInfo{
				UID:        "existing-target-uid",
				Type:       "elasticsearch",
				Name:       "Existing Target Name",
				APIVersion: "v2",
			},
		},
		{
			name:      "lookup by name",
			nameOrRef: "Existing Target Name",
			expected: &schemaversion.DataSourceInfo{
				UID:        "existing-target-uid",
				Type:       "elasticsearch",
				Name:       "Existing Target Name",
				APIVersion: "v2",
			},
		},
		{
			name:      "lookup by UID without apiVersion",
			nameOrRef: "existing-ref-uid",
			expected: &schemaversion.DataSourceInfo{
				UID:        "existing-ref-uid",
				Type:       "prometheus",
				Name:       "Existing Ref Name",
				APIVersion: "v1",
			},
		},
		{
			name: "lookup by reference object with UID",
			nameOrRef: map[string]interface{}{
				"uid": "existing-target-uid",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "existing-target-uid",
				Type:       "elasticsearch",
				Name:       "Existing Target Name",
				APIVersion: "v2",
			},
		},
		{
			name: "lookup by reference object without UID should find by type",
			nameOrRef: map[string]interface{}{
				"type": "elasticsearch",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "existing-target-uid",
				Type:       "elasticsearch",
				Name:       "Existing Target Name",
				APIVersion: "v2",
			},
		},
		{
			name:      "unknown datasource should return nil",
			nameOrRef: "unknown-ds",
			expected:  nil,
		},
		{
			name:      "empty string should return nil",
			nameOrRef: "",
			expected:  nil,
		},
		{
			name:      "unsupported input type should return default",
			nameOrRef: 123,
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds-uid",
				Type:       "prometheus",
				Name:       "Default Test Datasource Name",
				APIVersion: "v1",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := schemaversion.GetInstanceSettings(tt.nameOrRef, datasources)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMigrateDatasourceNameToRef(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "default-ds-uid", Type: "prometheus", Name: "Default Test Datasource Name", Default: true, APIVersion: "v1"},
		{UID: "existing-target-uid", Type: "elasticsearch", Name: "Existing Target Name", Default: false, APIVersion: "v2"},
		{UID: "existing-ref-uid", Type: "prometheus", Name: "Existing Ref Name", Default: false, APIVersion: "v1"},
	}

	t.Run("returnDefaultAsNull: true", func(t *testing.T) {
		options := map[string]bool{"returnDefaultAsNull": true}

		tests := []struct {
			name      string
			nameOrRef interface{}
			expected  map[string]interface{}
		}{
			{
				name:      "nil should return nil",
				nameOrRef: nil,
				expected:  nil,
			},
			{
				name:      "default should return nil",
				nameOrRef: "default",
				expected:  nil,
			},
			{
				name: "existing reference should be preserved",
				nameOrRef: map[string]interface{}{
					"uid":  "existing-uid",
					"type": "existing-type",
				},
				expected: map[string]interface{}{
					"uid":  "existing-uid",
					"type": "existing-type",
				},
			},
			{
				name:      "lookup by UID",
				nameOrRef: "existing-target-uid",
				expected: map[string]interface{}{
					"uid":        "existing-target-uid",
					"type":       "elasticsearch",
					"apiVersion": "v2",
				},
			},
			{
				name:      "lookup by name",
				nameOrRef: "Existing Target Name",
				expected: map[string]interface{}{
					"uid":        "existing-target-uid",
					"type":       "elasticsearch",
					"apiVersion": "v2",
				},
			},
			{
				name:      "unknown datasource should preserve as UID",
				nameOrRef: "unknown-ds",
				expected: map[string]interface{}{
					"uid": "unknown-ds",
				},
			},
			{
				name:      "empty string should return empty object",
				nameOrRef: "",
				expected:  map[string]interface{}{},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := schemaversion.MigrateDatasourceNameToRef(tt.nameOrRef, options, datasources)
				assert.Equal(t, tt.expected, result)
			})
		}
	})

	t.Run("returnDefaultAsNull: false", func(t *testing.T) {
		options := map[string]bool{"returnDefaultAsNull": false}

		tests := []struct {
			name      string
			nameOrRef interface{}
			expected  map[string]interface{}
		}{
			{
				name:      "nil should return default reference",
				nameOrRef: nil,
				expected: map[string]interface{}{
					"uid":        "default-ds-uid",
					"type":       "prometheus",
					"apiVersion": "v1",
				},
			},
			{
				name:      "default should return default reference",
				nameOrRef: "default",
				expected: map[string]interface{}{
					"uid":        "default-ds-uid",
					"type":       "prometheus",
					"apiVersion": "v1",
				},
			},
			{
				name: "existing reference should be preserved",
				nameOrRef: map[string]interface{}{
					"uid":  "existing-uid",
					"type": "existing-type",
				},
				expected: map[string]interface{}{
					"uid":  "existing-uid",
					"type": "existing-type",
				},
			},
			{
				name:      "lookup by UID",
				nameOrRef: "existing-target-uid",
				expected: map[string]interface{}{
					"uid":        "existing-target-uid",
					"type":       "elasticsearch",
					"apiVersion": "v2",
				},
			},
			{
				name:      "unknown datasource should preserve as UID",
				nameOrRef: "unknown-ds",
				expected: map[string]interface{}{
					"uid": "unknown-ds",
				},
			},
			{
				name:      "empty string should return empty object",
				nameOrRef: "",
				expected:  map[string]interface{}{},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := schemaversion.MigrateDatasourceNameToRef(tt.nameOrRef, options, datasources)
				assert.Equal(t, tt.expected, result)
			})
		}
	})

	t.Run("edge cases", func(t *testing.T) {
		options := map[string]bool{"returnDefaultAsNull": false}

		t.Run("reference without uid should lookup default", func(t *testing.T) {
			nameOrRef := map[string]interface{}{
				"type": "prometheus",
			}
			result := schemaversion.MigrateDatasourceNameToRef(nameOrRef, options, datasources)
			expected := map[string]interface{}{
				"uid":        "default-ds-uid",
				"type":       "prometheus",
				"apiVersion": "v1",
			}
			assert.Equal(t, expected, result)
		})

		t.Run("integer input should return default reference", func(t *testing.T) {
			result := schemaversion.MigrateDatasourceNameToRef(123, options, datasources)
			expected := map[string]interface{}{
				"uid":        "default-ds-uid",
				"type":       "prometheus",
				"apiVersion": "v1",
			}
			assert.Equal(t, expected, result)
		})

		t.Run("empty datasources list", func(t *testing.T) {
			result := schemaversion.MigrateDatasourceNameToRef("any-ds", options, []schemaversion.DataSourceInfo{})
			expected := map[string]interface{}{
				"uid": "any-ds",
			}
			assert.Equal(t, expected, result)
		})
	})
}

// TestTypeBasedLookupFix specifically tests our datasource type-based lookup fix.
// This test verifies that when a datasource reference object has a "type" but no "uid",
// the system should lookup by type instead of defaulting to prometheus.
func TestTypeBasedLookupFix(t *testing.T) {
	// Setup datasources similar to our dev dashboard configuration
	datasources := []schemaversion.DataSourceInfo{
		{
			UID:        "testdata-type-uid",
			Type:       "grafana-testdata-datasource",
			Name:       "grafana-testdata-datasource",
			Default:    true,
			APIVersion: "v1",
		},
		{
			UID:        "prometheus-uid",
			Type:       "prometheus",
			Name:       "Prometheus",
			Default:    false,
			APIVersion: "v1",
		},
		{
			UID:        "loki-uid",
			Type:       "loki",
			Name:       "Loki",
			Default:    false,
			APIVersion: "v1",
		},
	}

	tests := []struct {
		name      string
		nameOrRef interface{}
		expected  *schemaversion.DataSourceInfo
	}{
		{
			name: "type-only reference should find by type - grafana-testdata-datasource",
			nameOrRef: map[string]interface{}{
				"type": "grafana-testdata-datasource",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "testdata-type-uid",
				Type:       "grafana-testdata-datasource",
				Name:       "grafana-testdata-datasource",
				Default:    false, // GetInstanceSettings returns a copy without preserving Default field
				APIVersion: "v1",
			},
		},
		{
			name: "type-only reference should find by type - prometheus",
			nameOrRef: map[string]interface{}{
				"type": "prometheus",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "prometheus-uid",
				Type:       "prometheus",
				Name:       "Prometheus",
				Default:    false,
				APIVersion: "v1",
			},
		},
		{
			name: "type-only reference should find by type - loki",
			nameOrRef: map[string]interface{}{
				"type": "loki",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "loki-uid",
				Type:       "loki",
				Name:       "Loki",
				Default:    false,
				APIVersion: "v1",
			},
		},
		{
			name: "type-only reference with unknown type should default to testdata (default)",
			nameOrRef: map[string]interface{}{
				"type": "unknown-type",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "testdata-type-uid",
				Type:       "grafana-testdata-datasource",
				Name:       "grafana-testdata-datasource",
				Default:    false, // GetInstanceSettings returns a copy without preserving Default field
				APIVersion: "v1",
			},
		},
		{
			name: "type-only reference with non-string type should default to testdata",
			nameOrRef: map[string]interface{}{
				"type": 123,
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "testdata-type-uid",
				Type:       "grafana-testdata-datasource",
				Name:       "grafana-testdata-datasource",
				Default:    false, // GetInstanceSettings returns a copy without preserving Default field
				APIVersion: "v1",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := schemaversion.GetInstanceSettings(tt.nameOrRef, datasources)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMigrateDatasourceNameToRefTypeBasedLookup tests the MigrateDatasourceNameToRef function
// specifically for our type-based lookup fix scenario.
func TestMigrateDatasourceNameToRefTypeBasedLookup(t *testing.T) {
	// Setup datasources similar to our dev dashboard configuration
	datasources := []schemaversion.DataSourceInfo{
		{
			UID:        "testdata-type-uid",
			Type:       "grafana-testdata-datasource",
			Name:       "grafana-testdata-datasource",
			Default:    true,
			APIVersion: "v1",
		},
		{
			UID:        "prometheus-uid",
			Type:       "prometheus",
			Name:       "Prometheus",
			Default:    false,
			APIVersion: "v1",
		},
	}

	t.Run("type-based lookup in MigrateDatasourceNameToRef", func(t *testing.T) {
		options := map[string]bool{"returnDefaultAsNull": false}

		tests := []struct {
			name      string
			nameOrRef interface{}
			expected  map[string]interface{}
		}{
			{
				name: "type-only reference should lookup grafana-testdata-datasource",
				nameOrRef: map[string]interface{}{
					"type": "grafana-testdata-datasource",
				},
				expected: map[string]interface{}{
					"uid":        "testdata-type-uid",
					"type":       "grafana-testdata-datasource",
					"apiVersion": "v1",
				},
			},
			{
				name: "type-only reference should lookup prometheus",
				nameOrRef: map[string]interface{}{
					"type": "prometheus",
				},
				expected: map[string]interface{}{
					"uid":        "prometheus-uid",
					"type":       "prometheus",
					"apiVersion": "v1",
				},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := schemaversion.MigrateDatasourceNameToRef(tt.nameOrRef, options, datasources)
				assert.Equal(t, tt.expected, result)
			})
		}
	})
}

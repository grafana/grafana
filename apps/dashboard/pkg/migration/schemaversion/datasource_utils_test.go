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
				{UID: "ds1", Type: "prometheus", Name: "DS1", Default: false},
				{UID: "ds2", Type: "elasticsearch", Name: "DS2", Default: false},
			},
			expected: nil,
		},
		{
			name: "single default datasource",
			datasources: []schemaversion.DataSourceInfo{
				{UID: "ds1", Type: "prometheus", Name: "DS1", Default: false},
				{UID: "default-ds", Type: "prometheus", Name: "Default", Default: true, APIVersion: "v1"},
				{UID: "ds2", Type: "elasticsearch", Name: "DS2", Default: false},
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
				APIVersion: "v1",
			},
		},
		{
			name: "multiple default datasources returns first",
			datasources: []schemaversion.DataSourceInfo{
				{UID: "ds1", Type: "prometheus", Name: "Default1", Default: true, APIVersion: "v1"},
				{UID: "ds2", Type: "elasticsearch", Name: "Default2", Default: true, APIVersion: "v2"},
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "ds1",
				Type:       "prometheus",
				Name:       "Default1",
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
		{UID: "default-ds", Type: "prometheus", Name: "Default", Default: true, APIVersion: "v1"},
		{UID: "other-ds", Type: "elasticsearch", Name: "Elasticsearch", Default: false, APIVersion: "v2"},
		{UID: "test-uid", Type: "influxdb", Name: "InfluxDB", Default: false},
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
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
				APIVersion: "v1",
			},
		},
		{
			name:      "default string should return default",
			nameOrRef: "default",
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
				APIVersion: "v1",
			},
		},
		{
			name:      "lookup by UID",
			nameOrRef: "other-ds",
			expected: &schemaversion.DataSourceInfo{
				UID:        "other-ds",
				Type:       "elasticsearch",
				Name:       "Elasticsearch",
				APIVersion: "v2",
			},
		},
		{
			name:      "lookup by name",
			nameOrRef: "Elasticsearch",
			expected: &schemaversion.DataSourceInfo{
				UID:        "other-ds",
				Type:       "elasticsearch",
				Name:       "Elasticsearch",
				APIVersion: "v2",
			},
		},
		{
			name:      "lookup by UID without apiVersion",
			nameOrRef: "test-uid",
			expected: &schemaversion.DataSourceInfo{
				UID:        "test-uid",
				Type:       "influxdb",
				Name:       "InfluxDB",
				APIVersion: "",
			},
		},
		{
			name: "lookup by reference object with UID",
			nameOrRef: map[string]interface{}{
				"uid": "other-ds",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "other-ds",
				Type:       "elasticsearch",
				Name:       "Elasticsearch",
				APIVersion: "v2",
			},
		},
		{
			name: "lookup by reference object without UID",
			nameOrRef: map[string]interface{}{
				"type": "prometheus",
			},
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
				APIVersion: "v1",
			},
		},
		{
			name:      "unknown datasource should return default",
			nameOrRef: "unknown-ds",
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
				APIVersion: "v1",
			},
		},
		{
			name:      "empty string should return default",
			nameOrRef: "",
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
				APIVersion: "v1",
			},
		},
		{
			name:      "unsupported input type should return default",
			nameOrRef: 123,
			expected: &schemaversion.DataSourceInfo{
				UID:        "default-ds",
				Type:       "prometheus",
				Name:       "Default",
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
		{UID: "default-ds", Type: "prometheus", Name: "Default", Default: true, APIVersion: "v1"},
		{UID: "other-ds", Type: "elasticsearch", Name: "Elasticsearch", Default: false, APIVersion: "v2"},
		{UID: "test-uid", Type: "influxdb", Name: "InfluxDB", Default: false},
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
				nameOrRef: "other-ds",
				expected: map[string]interface{}{
					"uid":        "other-ds",
					"type":       "elasticsearch",
					"apiVersion": "v2",
				},
			},
			{
				name:      "lookup by name",
				nameOrRef: "Elasticsearch",
				expected: map[string]interface{}{
					"uid":        "other-ds",
					"type":       "elasticsearch",
					"apiVersion": "v2",
				},
			},
			{
				name:      "unknown datasource should return default reference",
				nameOrRef: "unknown-ds",
				expected: map[string]interface{}{
					"uid":        "default-ds",
					"type":       "prometheus",
					"apiVersion": "v1",
				},
			},
			{
				name:      "empty string should return default reference",
				nameOrRef: "",
				expected: map[string]interface{}{
					"uid":        "default-ds",
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
					"uid":        "default-ds",
					"type":       "prometheus",
					"apiVersion": "v1",
				},
			},
			{
				name:      "default should return default reference",
				nameOrRef: "default",
				expected: map[string]interface{}{
					"uid":        "default-ds",
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
				nameOrRef: "other-ds",
				expected: map[string]interface{}{
					"uid":        "other-ds",
					"type":       "elasticsearch",
					"apiVersion": "v2",
				},
			},
			{
				name:      "unknown datasource should return default reference",
				nameOrRef: "unknown-ds",
				expected: map[string]interface{}{
					"uid":        "default-ds",
					"type":       "prometheus",
					"apiVersion": "v1",
				},
			},
			{
				name:      "empty string should return default reference",
				nameOrRef: "",
				expected: map[string]interface{}{
					"uid":        "default-ds",
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

	t.Run("edge cases", func(t *testing.T) {
		options := map[string]bool{"returnDefaultAsNull": false}

		t.Run("reference without uid should lookup default", func(t *testing.T) {
			nameOrRef := map[string]interface{}{
				"type": "prometheus",
			}
			result := schemaversion.MigrateDatasourceNameToRef(nameOrRef, options, datasources)
			expected := map[string]interface{}{
				"uid":        "default-ds",
				"type":       "prometheus",
				"apiVersion": "v1",
			}
			assert.Equal(t, expected, result)
		})

		t.Run("integer input should return default reference", func(t *testing.T) {
			result := schemaversion.MigrateDatasourceNameToRef(123, options, datasources)
			expected := map[string]interface{}{
				"uid":        "default-ds",
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

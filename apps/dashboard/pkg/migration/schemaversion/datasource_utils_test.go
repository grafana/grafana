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

func TestResolveDatasourceRef(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "default-ds-uid", Type: "prometheus", Name: "Default Test Datasource Name", Default: true, APIVersion: "v1"},
		{UID: "existing-target-uid", Type: "elasticsearch", Name: "Existing Target Name", Default: false, APIVersion: "v2"},
	}
	index := schemaversion.NewDatasourceIndex(datasources)

	t.Run("nil index returns nil", func(t *testing.T) {
		assert.Nil(t, schemaversion.ResolveDatasourceRef("anything", nil))
	})

	t.Run("empty name returns nil", func(t *testing.T) {
		assert.Nil(t, schemaversion.ResolveDatasourceRef("", index))
	})

	t.Run("\"default\" sentinel resolves to the configured default datasource", func(t *testing.T) {
		ds := schemaversion.ResolveDatasourceRef("default", index)
		if assert.NotNil(t, ds) {
			assert.Equal(t, "default-ds-uid", ds.UID)
			assert.Equal(t, "prometheus", ds.Type)
		}
	})

	t.Run("\"default\" sentinel falls through to Lookup when no default is configured", func(t *testing.T) {
		emptyIndex := schemaversion.NewDatasourceIndex([]schemaversion.DataSourceInfo{})
		assert.Nil(t, schemaversion.ResolveDatasourceRef("default", emptyIndex))
	})

	t.Run("known name resolves via the index", func(t *testing.T) {
		ds := schemaversion.ResolveDatasourceRef("Existing Target Name", index)
		if assert.NotNil(t, ds) {
			assert.Equal(t, "existing-target-uid", ds.UID)
			assert.Equal(t, "elasticsearch", ds.Type)
		}
	})

	t.Run("known UID resolves via the index", func(t *testing.T) {
		ds := schemaversion.ResolveDatasourceRef("existing-target-uid", index)
		if assert.NotNil(t, ds) {
			assert.Equal(t, "existing-target-uid", ds.UID)
			assert.Equal(t, "elasticsearch", ds.Type)
		}
	})

	t.Run("unknown name returns nil", func(t *testing.T) {
		assert.Nil(t, schemaversion.ResolveDatasourceRef("unknown-ds", index))
	})
}

func TestMigrateDatasourceNameToRef(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "default-ds-uid", Type: "prometheus", Name: "Default Test Datasource Name", Default: true, APIVersion: "v1"},
		{UID: "existing-target-uid", Type: "elasticsearch", Name: "Existing Target Name", Default: false, APIVersion: "v2"},
		{UID: "existing-ref-uid", Type: "prometheus", Name: "Existing Ref Name", Default: false, APIVersion: "v1"},
	}
	index := schemaversion.NewDatasourceIndex(datasources)

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
				result := schemaversion.MigrateDatasourceNameToRef(tt.nameOrRef, options, index)
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
				result := schemaversion.MigrateDatasourceNameToRef(tt.nameOrRef, options, index)
				assert.Equal(t, tt.expected, result)
			})
		}
	})

	t.Run("edge cases", func(t *testing.T) {
		options := map[string]bool{"returnDefaultAsNull": false}

		t.Run("reference without uid should be preserved as-is", func(t *testing.T) {
			nameOrRef := map[string]interface{}{
				"type": "prometheus",
			}
			result := schemaversion.MigrateDatasourceNameToRef(nameOrRef, options, index)
			expected := map[string]interface{}{
				"type": "prometheus",
			}
			assert.Equal(t, expected, result)
		})

		t.Run("integer input should return nil", func(t *testing.T) {
			result := schemaversion.MigrateDatasourceNameToRef(123, options, index)
			expected := map[string]interface{}(nil)
			assert.Equal(t, expected, result)
		})

		t.Run("empty datasources list", func(t *testing.T) {
			emptyIndex := schemaversion.NewDatasourceIndex([]schemaversion.DataSourceInfo{})
			result := schemaversion.MigrateDatasourceNameToRef("any-ds", options, emptyIndex)
			expected := map[string]interface{}{
				"uid": "any-ds",
			}
			assert.Equal(t, expected, result)
		})

		t.Run("nil input with no default configured returns nil", func(t *testing.T) {
			emptyIndex := schemaversion.NewDatasourceIndex([]schemaversion.DataSourceInfo{})
			result := schemaversion.MigrateDatasourceNameToRef(nil, options, emptyIndex)
			assert.Nil(t, result)
		})

		t.Run("\"default\" with no default configured preserves as UID-only", func(t *testing.T) {
			emptyIndex := schemaversion.NewDatasourceIndex([]schemaversion.DataSourceInfo{})
			result := schemaversion.MigrateDatasourceNameToRef("default", options, emptyIndex)
			expected := map[string]interface{}{
				"uid": "default",
			}
			assert.Equal(t, expected, result)
		})
	})
}

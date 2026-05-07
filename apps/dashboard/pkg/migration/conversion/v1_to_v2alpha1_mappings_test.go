package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func TestConvertAnnotationMappings_V1_to_V2alpha1(t *testing.T) {
	t.Run("should convert mappings with all fields", func(t *testing.T) {
		mappingsMap := map[string]interface{}{
			"title": map[string]interface{}{
				"source": "field",
				"value":  "service",
				"regex":  "",
			},
			"text": map[string]interface{}{
				"source": "text",
				"value":  "constant text",
			},
			"time": map[string]interface{}{
				"source": "field",
				"value":  "timestamp",
			},
			"tags": map[string]interface{}{
				"source": "field",
				"value":  "labels",
				"regex":  "/(.*)/",
			},
		}

		result := convertAnnotationMappings_V1_to_V2alpha1(mappingsMap)

		require.Len(t, result, 4)

		// Check title mapping
		titleMapping, ok := result["title"]
		require.True(t, ok)
		assert.Equal(t, "field", *titleMapping.Source)
		assert.Equal(t, "service", *titleMapping.Value)
		assert.Nil(t, titleMapping.Regex)

		// Check text mapping
		textMapping, ok := result["text"]
		require.True(t, ok)
		assert.Equal(t, "text", *textMapping.Source)
		assert.Equal(t, "constant text", *textMapping.Value)
		assert.Nil(t, textMapping.Regex)

		// Check time mapping
		timeMapping, ok := result["time"]
		require.True(t, ok)
		assert.Equal(t, "field", *timeMapping.Source)
		assert.Equal(t, "timestamp", *timeMapping.Value)
		assert.Nil(t, timeMapping.Regex)

		// Check tags mapping
		tagsMapping, ok := result["tags"]
		require.True(t, ok)
		assert.Equal(t, "field", *tagsMapping.Source)
		assert.Equal(t, "labels", *tagsMapping.Value)
		assert.Equal(t, "/(.*)/", *tagsMapping.Regex)
	})

	t.Run("should default source to field when not specified", func(t *testing.T) {
		mappingsMap := map[string]interface{}{
			"title": map[string]interface{}{
				"value": "service",
			},
		}

		result := convertAnnotationMappings_V1_to_V2alpha1(mappingsMap)

		require.Len(t, result, 1)
		titleMapping, ok := result["title"]
		require.True(t, ok)
		assert.Equal(t, "field", *titleMapping.Source)
		assert.Equal(t, "service", *titleMapping.Value)
	})

	t.Run("should handle empty source string by defaulting to field", func(t *testing.T) {
		mappingsMap := map[string]interface{}{
			"title": map[string]interface{}{
				"source": "",
				"value":  "service",
			},
		}

		result := convertAnnotationMappings_V1_to_V2alpha1(mappingsMap)

		require.Len(t, result, 1)
		titleMapping, ok := result["title"]
		require.True(t, ok)
		assert.Equal(t, "field", *titleMapping.Source)
	})

	t.Run("should handle skip source", func(t *testing.T) {
		mappingsMap := map[string]interface{}{
			"title": map[string]interface{}{
				"source": "skip",
			},
		}

		result := convertAnnotationMappings_V1_to_V2alpha1(mappingsMap)

		require.Len(t, result, 1)
		titleMapping, ok := result["title"]
		require.True(t, ok)
		assert.Equal(t, "skip", *titleMapping.Source)
		assert.Nil(t, titleMapping.Value)
		assert.Nil(t, titleMapping.Regex)
	})

	t.Run("should skip invalid mapping entries", func(t *testing.T) {
		mappingsMap := map[string]interface{}{
			"title": map[string]interface{}{
				"source": "field",
				"value":  "service",
			},
			"invalid": 123, // Invalid: not a string or map
			"text": map[string]interface{}{
				"source": "text",
				"value":  "constant",
			},
		}

		result := convertAnnotationMappings_V1_to_V2alpha1(mappingsMap)

		// Should have 2 valid mappings (title and text)
		// String values are now treated as valid legacy format mappings
		require.Len(t, result, 2)
		_, ok := result["title"]
		require.True(t, ok)
		_, ok = result["text"]
		require.True(t, ok)
		_, ok = result["invalid"]
		assert.False(t, ok, "invalid entry should be skipped")
	})

	t.Run("should handle empty mappings map", func(t *testing.T) {
		mappingsMap := map[string]interface{}{}

		result := convertAnnotationMappings_V1_to_V2alpha1(mappingsMap)

		assert.Empty(t, result)
	})
}

func TestBuildAnnotationQuery_Mappings(t *testing.T) {
	t.Run("should extract mappings to top-level property", func(t *testing.T) {
		annotationMap := map[string]interface{}{
			"name":      "Test Annotation",
			"enable":    true,
			"hide":      false,
			"iconColor": "red",
			"datasource": map[string]interface{}{
				"type": "prometheus",
				"uid":  "test-uid",
			},
			"target": map[string]interface{}{
				"expr": "test_query",
			},
			"mappings": map[string]interface{}{
				"title": map[string]interface{}{
					"source": "field",
					"value":  "service",
				},
				"text": map[string]interface{}{
					"source": "text",
					"value":  "constant text",
				},
				"time": map[string]interface{}{
					"source": "field",
					"value":  "timestamp",
					"regex":  "",
				},
			},
		}

		result, err := buildAnnotationQuery(annotationMap)
		require.NoError(t, err)

		// Verify mappings are in the correct location
		require.NotNil(t, result.Spec.Mappings)
		assert.Len(t, result.Spec.Mappings, 3)

		// Verify mappings content
		titleMapping, ok := result.Spec.Mappings["title"]
		require.True(t, ok)
		assert.Equal(t, "field", *titleMapping.Source)
		assert.Equal(t, "service", *titleMapping.Value)

		textMapping, ok := result.Spec.Mappings["text"]
		require.True(t, ok)
		assert.Equal(t, "text", *textMapping.Source)
		assert.Equal(t, "constant text", *textMapping.Value)

		// Verify mappings are NOT in legacyOptions
		if result.Spec.LegacyOptions != nil {
			_, hasMappingsInLegacy := result.Spec.LegacyOptions["mappings"]
			assert.False(t, hasMappingsInLegacy, "mappings should not be in legacyOptions")
		}
	})

	t.Run("should handle annotation without mappings", func(t *testing.T) {
		annotationMap := map[string]interface{}{
			"name":      "Test Annotation",
			"enable":    true,
			"hide":      false,
			"iconColor": "red",
			"datasource": map[string]interface{}{
				"type": "prometheus",
				"uid":  "test-uid",
			},
			"target": map[string]interface{}{
				"expr": "test_query",
			},
		}

		result, err := buildAnnotationQuery(annotationMap)
		require.NoError(t, err)

		// Mappings should be nil when not present
		assert.Nil(t, result.Spec.Mappings)
	})

	t.Run("should handle empty mappings", func(t *testing.T) {
		annotationMap := map[string]interface{}{
			"name":      "Test Annotation",
			"enable":    true,
			"hide":      false,
			"iconColor": "red",
			"datasource": map[string]interface{}{
				"type": "prometheus",
				"uid":  "test-uid",
			},
			"target": map[string]interface{}{
				"expr": "test_query",
			},
			"mappings": map[string]interface{}{},
		}

		result, err := buildAnnotationQuery(annotationMap)
		require.NoError(t, err)

		// Empty mappings should result in empty map
		assert.NotNil(t, result.Spec.Mappings)
		assert.Empty(t, result.Spec.Mappings)
	})

	t.Run("should exclude mappings from legacyOptions", func(t *testing.T) {
		annotationMap := map[string]interface{}{
			"name":      "Test Annotation",
			"enable":    true,
			"hide":      false,
			"iconColor": "red",
			"datasource": map[string]interface{}{
				"type": "prometheus",
				"uid":  "test-uid",
			},
			"target": map[string]interface{}{
				"expr": "test_query",
			},
			"mappings": map[string]interface{}{
				"title": map[string]interface{}{
					"source": "field",
					"value":  "service",
				},
			},
			"type":        "prometheus",
			"customField": "customValue",
		}

		result, err := buildAnnotationQuery(annotationMap)
		require.NoError(t, err)

		// Verify mappings are in the correct location
		require.NotNil(t, result.Spec.Mappings)
		assert.Len(t, result.Spec.Mappings, 1)

		// Verify other fields are in legacyOptions
		require.NotNil(t, result.Spec.LegacyOptions)
		assert.Equal(t, "prometheus", result.Spec.LegacyOptions["type"])
		assert.Equal(t, "customValue", result.Spec.LegacyOptions["customField"])

		// Verify mappings are NOT in legacyOptions
		_, hasMappingsInLegacy := result.Spec.LegacyOptions["mappings"]
		assert.False(t, hasMappingsInLegacy, "mappings should not be in legacyOptions")
	})

	t.Run("should handle mappings with regex", func(t *testing.T) {
		annotationMap := map[string]interface{}{
			"name":      "Test Annotation",
			"enable":    true,
			"hide":      false,
			"iconColor": "red",
			"datasource": map[string]interface{}{
				"type": "prometheus",
				"uid":  "test-uid",
			},
			"target": map[string]interface{}{
				"expr": "test_query",
			},
			"mappings": map[string]interface{}{
				"tags": map[string]interface{}{
					"source": "field",
					"value":  "labels",
					"regex":  "/(.*)/",
				},
			},
		}

		result, err := buildAnnotationQuery(annotationMap)
		require.NoError(t, err)

		require.NotNil(t, result.Spec.Mappings)
		tagsMapping, ok := result.Spec.Mappings["tags"]
		require.True(t, ok)
		assert.Equal(t, "field", *tagsMapping.Source)
		assert.Equal(t, "labels", *tagsMapping.Value)
		assert.Equal(t, "/(.*)/", *tagsMapping.Regex)
	})
}

func TestTransformVariableHideToEnum_V1_to_V2alpha1(t *testing.T) {
	tests := []struct {
		name string
		in   interface{}
		want dashv2alpha1.DashboardVariableHide
	}{
		{"nil", nil, dashv2alpha1.DashboardVariableHideDontHide},
		{"int 0 -> dontHide", 0, dashv2alpha1.DashboardVariableHideDontHide},
		{"int 1 -> hideLabel", 1, dashv2alpha1.DashboardVariableHideHideLabel},
		{"int 2 -> hideVariable", 2, dashv2alpha1.DashboardVariableHideHideVariable},
		{"int 3 -> inControlsMenu", 3, dashv2alpha1.DashboardVariableHideInControlsMenu},
		{"int 99 -> dontHide (fallback)", 99, dashv2alpha1.DashboardVariableHideDontHide},
		// JSON unmarshal yields numbers as float64; make sure that path works too.
		{"float64 3 -> inControlsMenu", float64(3), dashv2alpha1.DashboardVariableHideInControlsMenu},
		{"string empty -> dontHide", "", dashv2alpha1.DashboardVariableHideDontHide},
		{"string dontHide", "dontHide", dashv2alpha1.DashboardVariableHideDontHide},
		{"string hideLabel", "hideLabel", dashv2alpha1.DashboardVariableHideHideLabel},
		{"string hideVariable", "hideVariable", dashv2alpha1.DashboardVariableHideHideVariable},
		{"string inControlsMenu", "inControlsMenu", dashv2alpha1.DashboardVariableHideInControlsMenu},
		{"string unknown -> dontHide", "bogus", dashv2alpha1.DashboardVariableHideDontHide},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, transformVariableHideToEnum(tt.in))
		})
	}
}

func TestTransformVariableHideFromEnum_V2alpha1_to_V1(t *testing.T) {
	tests := []struct {
		name string
		in   dashv2alpha1.DashboardVariableHide
		want interface{}
	}{
		{"dontHide -> 0", dashv2alpha1.DashboardVariableHideDontHide, 0},
		{"hideLabel -> 1", dashv2alpha1.DashboardVariableHideHideLabel, 1},
		{"hideVariable -> 2", dashv2alpha1.DashboardVariableHideHideVariable, 2},
		{"inControlsMenu -> 3", dashv2alpha1.DashboardVariableHideInControlsMenu, 3},
		{"unknown -> 0 (fallback)", dashv2alpha1.DashboardVariableHide("bogus"), 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, transformVariableHideFromEnum(tt.in))
		})
	}
}

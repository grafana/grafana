package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertAnnotationMappings_V1beta1_to_V2alpha1(t *testing.T) {
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

		result := convertAnnotationMappings_V1beta1_to_V2alpha1(mappingsMap)

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

		result := convertAnnotationMappings_V1beta1_to_V2alpha1(mappingsMap)

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

		result := convertAnnotationMappings_V1beta1_to_V2alpha1(mappingsMap)

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

		result := convertAnnotationMappings_V1beta1_to_V2alpha1(mappingsMap)

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

		result := convertAnnotationMappings_V1beta1_to_V2alpha1(mappingsMap)

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

		result := convertAnnotationMappings_V1beta1_to_V2alpha1(mappingsMap)

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

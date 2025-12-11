package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func TestConvertAnnotationMappings_V2alpha1_to_V1beta1(t *testing.T) {
	t.Run("should convert simple field mappings to structured format with source and value", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"title": {
				Source: ptr.To("field"),
				Value:  ptr.To("service"),
			},
			"text": {
				Source: ptr.To("field"),
				Value:  ptr.To("description"),
			},
			"time": {
				Source: ptr.To("field"),
				Value:  ptr.To("timestamp"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 3)
		// All mappings should be in structured format with source and value
		titleMapping, ok := result["title"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "field", titleMapping["source"])
		assert.Equal(t, "service", titleMapping["value"])

		textMapping, ok := result["text"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "field", textMapping["source"])
		assert.Equal(t, "description", textMapping["value"])

		timeMapping, ok := result["time"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "field", timeMapping["source"])
		assert.Equal(t, "timestamp", timeMapping["value"])
	})

	t.Run("should convert mappings with default field source to structured format", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"title": {
				Source: nil, // nil defaults to "field"
				Value:  ptr.To("service"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 1)
		titleMapping, ok := result["title"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "field", titleMapping["source"])
		assert.Equal(t, "service", titleMapping["value"])
	})

	t.Run("should preserve complex mappings with regex as structured format", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"tags": {
				Source: ptr.To("field"),
				Value:  ptr.To("labels"),
				Regex:  ptr.To("/(.*)/"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 1)
		tagsMapping, ok := result["tags"].(map[string]interface{})
		require.True(t, ok, "tags mapping should be a map")
		assert.Equal(t, "field", tagsMapping["source"])
		assert.Equal(t, "labels", tagsMapping["value"])
		assert.Equal(t, "/(.*)/", tagsMapping["regex"])
	})

	t.Run("should preserve mappings with non-field source as structured format", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"text": {
				Source: ptr.To("text"),
				Value:  ptr.To("constant text"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 1)
		textMapping, ok := result["text"].(map[string]interface{})
		require.True(t, ok, "text mapping should be a map")
		assert.Equal(t, "text", textMapping["source"])
		assert.Equal(t, "constant text", textMapping["value"])
	})

	t.Run("should preserve mappings with skip source as structured format", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"title": {
				Source: ptr.To("skip"),
			},
			"text": {
				Source: ptr.To("field"),
				Value:  ptr.To("description"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 2)
		// Skip mapping should be preserved as structured format
		titleMapping, ok := result["title"].(map[string]interface{})
		require.True(t, ok, "skip mapping should be preserved as map")
		assert.Equal(t, "skip", titleMapping["source"])
		// Field mapping should be structured format with source and value
		textMapping, ok := result["text"].(map[string]interface{})
		require.True(t, ok, "field mapping should be structured format")
		assert.Equal(t, "field", textMapping["source"])
		assert.Equal(t, "description", textMapping["value"])
	})

	t.Run("should skip mappings without value", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"title": {
				Source: ptr.To("field"),
				Value:  nil,
			},
			"text": {
				Source: ptr.To("field"),
				Value:  ptr.To(""),
			},
			"time": {
				Source: ptr.To("field"),
				Value:  ptr.To("timestamp"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 1)
		_, ok := result["title"]
		assert.False(t, ok, "mapping without value should be skipped")
		_, ok = result["text"]
		assert.False(t, ok, "mapping with empty value should be skipped")
		_, ok = result["time"]
		assert.True(t, ok, "mapping with value should be included")
	})

	t.Run("should handle empty mappings map", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		assert.Empty(t, result)
	})

	t.Run("should handle all mappings in structured format", func(t *testing.T) {
		mappings := map[string]dashv2alpha1.DashboardAnnotationEventFieldMapping{
			"title": {
				Source: ptr.To("field"),
				Value:  ptr.To("service"),
			},
			"tags": {
				Source: ptr.To("field"),
				Value:  ptr.To("labels"),
				Regex:  ptr.To("/(.*)/"),
			},
			"text": {
				Source: ptr.To("text"),
				Value:  ptr.To("constant"),
			},
		}

		result := convertAnnotationMappings_V2alpha1_to_V1beta1(mappings)

		require.Len(t, result, 3)
		// All mappings should be in structured format
		titleMapping, ok := result["title"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "field", titleMapping["source"])
		assert.Equal(t, "service", titleMapping["value"])

		tagsMapping, ok := result["tags"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "field", tagsMapping["source"])
		assert.Equal(t, "labels", tagsMapping["value"])
		assert.Equal(t, "/(.*)/", tagsMapping["regex"])

		textMapping, ok := result["text"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "text", textMapping["source"])
		assert.Equal(t, "constant", textMapping["value"])
	})
}

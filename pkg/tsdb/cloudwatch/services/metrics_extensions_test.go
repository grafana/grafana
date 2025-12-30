package services

import (
	"testing"

	"github.com/grafana/grafana-aws-sdk/pkg/cloudWatchConsts"
	"github.com/stretchr/testify/assert"
)

func TestBedrockCacheMetrics(t *testing.T) {
	t.Run("AWS/Bedrock namespace should include CacheWriteInputTokenCount metric", func(t *testing.T) {
		metrics := cloudWatchConsts.NamespaceMetricsMap["AWS/Bedrock"]
		assert.Contains(t, metrics, "CacheWriteInputTokenCount")
	})

	t.Run("AWS/Bedrock namespace should include CacheWriteOutputTokenCount metric", func(t *testing.T) {
		metrics := cloudWatchConsts.NamespaceMetricsMap["AWS/Bedrock"]
		assert.Contains(t, metrics, "CacheWriteOutputTokenCount")
	})

	t.Run("GetHardCodedMetricsByNamespace should return Bedrock cache metrics", func(t *testing.T) {
		resp, err := GetHardCodedMetricsByNamespace("AWS/Bedrock")
		assert.NoError(t, err)

		var foundCacheWriteInput, foundCacheWriteOutput bool
		for _, metric := range resp {
			if metric.Value.Name == "CacheWriteInputTokenCount" {
				foundCacheWriteInput = true
			}
			if metric.Value.Name == "CacheWriteOutputTokenCount" {
				foundCacheWriteOutput = true
			}
		}

		assert.True(t, foundCacheWriteInput, "CacheWriteInputTokenCount metric should be returned")
		assert.True(t, foundCacheWriteOutput, "CacheWriteOutputTokenCount metric should be returned")
	})
}

func TestContainsMetric(t *testing.T) {
	t.Run("should return true if metric exists", func(t *testing.T) {
		metrics := []string{"MetricA", "MetricB", "MetricC"}
		assert.True(t, containsMetric(metrics, "MetricB"))
	})

	t.Run("should return false if metric does not exist", func(t *testing.T) {
		metrics := []string{"MetricA", "MetricB", "MetricC"}
		assert.False(t, containsMetric(metrics, "MetricD"))
	})

	t.Run("should return false for empty slice", func(t *testing.T) {
		metrics := []string{}
		assert.False(t, containsMetric(metrics, "MetricA"))
	})
}

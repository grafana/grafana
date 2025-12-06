package services

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHardcodedMetrics_GetHardCodedDimensionKeysByNamespace(t *testing.T) {
	t.Run("Should return an error in case namespace doesnt exist in map", func(t *testing.T) {
		resp, err := GetHardCodedDimensionKeysByNamespace("unknownNamespace")
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, err.Error(), "unable to find dimensions for namespace '\"unknownNamespace\"'")
	})

	t.Run("Should return keys if namespace exist", func(t *testing.T) {
		resp, err := GetHardCodedDimensionKeysByNamespace("AWS/EC2")
		require.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[string]{{Value: "AutoScalingGroupName"}, {Value: "ImageId"}, {Value: "InstanceId"}, {Value: "InstanceType"}}, resp)
	})
}

func TestHardcodedMetrics_GetHardCodedMetricsByNamespace(t *testing.T) {
	t.Run("Should return an error in case namespace doesnt exist in map", func(t *testing.T) {
		resp, err := GetHardCodedMetricsByNamespace("unknownNamespace")
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, err.Error(), "unable to find metrics for namespace '\"unknownNamespace\"'")
	})

	t.Run("Should return metrics if namespace exist", func(t *testing.T) {
		resp, err := GetHardCodedMetricsByNamespace("AWS/IoTAnalytics")
		require.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.Metric]{{Value: resources.Metric{Name: "ActionExecution", Namespace: "AWS/IoTAnalytics"}}, {Value: resources.Metric{Name: "ActivityExecutionError", Namespace: "AWS/IoTAnalytics"}}, {Value: resources.Metric{Name: "IncomingMessages", Namespace: "AWS/IoTAnalytics"}}}, resp)
	})

	t.Run("Should return extended metrics for AWS/RDS namespace", func(t *testing.T) {
		resp, err := GetHardCodedMetricsByNamespace("AWS/RDS")
		require.NoError(t, err)
		require.NotEmpty(t, resp, "AWS/RDS should have metrics")

		// Verify that extended metrics are included
		metricNames := make(map[string]bool)
		for _, metricResp := range resp {
			metricNames[metricResp.Value.Name] = true
		}

		// Check for Performance Insights metrics
		assert.True(t, metricNames["DBLoad"], "Should include DBLoad metric")
		assert.True(t, metricNames["DBLoadCPU"], "Should include DBLoadCPU metric")
		assert.True(t, metricNames["db.wait_event.name"], "Should include wait event metric")

		// Check for Enhanced Monitoring metrics
		assert.True(t, metricNames["cpuUtilization.total"], "Should include CPU utilization metric")
		assert.True(t, metricNames["memory.total"], "Should include memory total metric")
		assert.True(t, metricNames["diskIO.readIOsPS"], "Should include disk I/O metric")

		// Verify all extended metrics are present
		extendedMetrics := GetExtendedRDSMetrics()
		for _, extMetric := range extendedMetrics {
			assert.True(t, metricNames[extMetric], "AWS/RDS should include extended metric: %s", extMetric)
		}
	})
}

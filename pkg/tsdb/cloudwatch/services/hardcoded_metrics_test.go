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
		assert.Equal(t, []string{"AutoScalingGroupName", "ImageId", "InstanceId", "InstanceType"}, resp)
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
		assert.Equal(t, []resources.Metric{{Name: "ActionExecution", Namespace: "AWS/IoTAnalytics"}, {Name: "ActivityExecutionError", Namespace: "AWS/IoTAnalytics"}, {Name: "IncomingMessages", Namespace: "AWS/IoTAnalytics"}}, resp)
	})
}

package resources

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDimensionValuesRequest(t *testing.T) {
	t.Run("Should parse parameters without dimension filter", func(t *testing.T) {
		request, err := GetDimensionValuesRequest(map[string][]string{
			"region":       {"us-east-1"},
			"namespace":    {"AWS/EC2"},
			"metricName":   {"CPUUtilization"},
			"dimensionKey": {"InstanceId"}},
		)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
		assert.Equal(t, "InstanceId", request.DimensionKey)
	})

	t.Run("Should parse parameters with single valued dimension filter", func(t *testing.T) {
		request, err := GetDimensionValuesRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionKey":     {"InstanceId"},
			"dimensionFilters": {"{\"InstanceId\": \"i-1234567890abcdef0\"}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
		assert.Equal(t, 1, len(request.DimensionFilter))
		assert.Equal(t, "InstanceId", request.DimensionKey)
		assert.Equal(t, "InstanceId", request.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", request.DimensionFilter[0].Value)
	})

	t.Run("Should parse parameters with multi-valued dimension filter", func(t *testing.T) {
		request, err := GetDimensionValuesRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionKey":     {"InstanceId"},
			"dimensionFilters": {"{\"InstanceId\": [\"i-1234567890abcdef0\", \"i-1234567890abcdef1\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
		assert.Equal(t, 2, len(request.DimensionFilter))
		assert.Equal(t, "InstanceId", request.DimensionKey)
		assert.Equal(t, "InstanceId", request.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", request.DimensionFilter[0].Value)
		assert.Equal(t, "InstanceId", request.DimensionFilter[1].Name)
		assert.Equal(t, "i-1234567890abcdef1", request.DimensionFilter[1].Value)
	})

	t.Run("Should parse parameters with wildcard dimension filter", func(t *testing.T) {
		request, err := GetDimensionValuesRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": [\"*\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
		assert.Equal(t, 1, len(request.DimensionFilter))
		assert.Equal(t, "InstanceId", request.DimensionFilter[0].Name)
		assert.Equal(t, "", request.DimensionFilter[0].Value)
	})
}

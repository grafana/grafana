package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDimensionKeyQuery(t *testing.T) {
	t.Run("Should parse parameters without dimension filter", func(t *testing.T) {
		req, err := GetDimensionKeysRequest(map[string][]string{
			"region":     {"us-east-1"},
			"namespace":  {"AWS/EC2"},
			"metricName": {"CPUUtilization"}},
		)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", req.Region)
		assert.Equal(t, "AWS/EC2", req.Namespace)
		assert.Equal(t, "CPUUtilization", req.MetricName)
	})

	t.Run("Should parse parameters with single valued dimension filter", func(t *testing.T) {
		req, err := GetDimensionKeysRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": \"i-1234567890abcdef0\"}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", req.Region)
		assert.Equal(t, "AWS/EC2", req.Namespace)
		assert.Equal(t, "CPUUtilization", req.MetricName)
		assert.Equal(t, 1, len(req.DimensionFilter))
		assert.Equal(t, "InstanceId", req.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", req.DimensionFilter[0].Value)
	})

	t.Run("Should parse parameters with multi-valued dimension filter", func(t *testing.T) {
		req, err := GetDimensionKeysRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": [\"i-1234567890abcdef0\", \"i-1234567890abcdef1\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", req.Region)
		assert.Equal(t, "AWS/EC2", req.Namespace)
		assert.Equal(t, "CPUUtilization", req.MetricName)
		assert.Equal(t, 2, len(req.DimensionFilter))
		assert.Equal(t, "InstanceId", req.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", req.DimensionFilter[0].Value)
		assert.Equal(t, "InstanceId", req.DimensionFilter[1].Name)
		assert.Equal(t, "i-1234567890abcdef1", req.DimensionFilter[1].Value)
	})

	t.Run("Should parse parameters with wildcard dimension filter", func(t *testing.T) {
		req, err := GetDimensionKeysRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": [\"*\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", req.Region)
		assert.Equal(t, "AWS/EC2", req.Namespace)
		assert.Equal(t, "CPUUtilization", req.MetricName)
		assert.Equal(t, 1, len(req.DimensionFilter))
		assert.Equal(t, "InstanceId", req.DimensionFilter[0].Name)
		assert.Equal(t, "", req.DimensionFilter[0].Value)
	})
}

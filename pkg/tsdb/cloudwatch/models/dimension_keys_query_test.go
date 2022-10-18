package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDimensionKeyQuery(t *testing.T) {
	t.Run("Should parse parameters without dimension filter", func(t *testing.T) {
		query, err := GetDimensionKeysQuery(map[string][]string{
			"region":     {"us-east-1"},
			"namespace":  {"AWS/EC2"},
			"metricName": {"CPUUtilization"}},
		)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", query.Region)
		assert.Equal(t, "AWS/EC2", query.Namespace)
		assert.Equal(t, "CPUUtilization", query.MetricName)
	})

	t.Run("Should parse parameters with single valued dimension filter", func(t *testing.T) {
		query, err := GetDimensionKeysQuery(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": \"i-1234567890abcdef0\"}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", query.Region)
		assert.Equal(t, "AWS/EC2", query.Namespace)
		assert.Equal(t, "CPUUtilization", query.MetricName)
		assert.Equal(t, 1, len(query.DimensionFilter))
		assert.Equal(t, "InstanceId", query.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", query.DimensionFilter[0].Value)
	})

	t.Run("Should parse parameters with multi-valued dimension filter", func(t *testing.T) {
		query, err := GetDimensionKeysQuery(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": [\"i-1234567890abcdef0\", \"i-1234567890abcdef1\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", query.Region)
		assert.Equal(t, "AWS/EC2", query.Namespace)
		assert.Equal(t, "CPUUtilization", query.MetricName)
		assert.Equal(t, 2, len(query.DimensionFilter))
		assert.Equal(t, "InstanceId", query.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", query.DimensionFilter[0].Value)
		assert.Equal(t, "InstanceId", query.DimensionFilter[1].Name)
		assert.Equal(t, "i-1234567890abcdef1", query.DimensionFilter[1].Value)
	})

	t.Run("Should parse parameters with wildcard dimension filter", func(t *testing.T) {
		query, err := GetDimensionKeysQuery(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": [\"*\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", query.Region)
		assert.Equal(t, "AWS/EC2", query.Namespace)
		assert.Equal(t, "CPUUtilization", query.MetricName)
		assert.Equal(t, 1, len(query.DimensionFilter))
		assert.Equal(t, "InstanceId", query.DimensionFilter[0].Name)
		assert.Equal(t, "", query.DimensionFilter[0].Value)
	})
}

package resources

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDimensionKeyRequest(t *testing.T) {
	t.Run("Should parse parameters without dimension filter", func(t *testing.T) {
		request, err := GetDimensionKeysRequest(map[string][]string{
			"region":     {"us-east-1"},
			"namespace":  {"AWS/EC2"},
			"metricName": {"CPUUtilization"}},
		)
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
	})

	t.Run("Should parse parameters with single valued dimension filter", func(t *testing.T) {
		request, err := GetDimensionKeysRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": \"i-1234567890abcdef0\"}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
		assert.Equal(t, 1, len(request.DimensionFilter))
		assert.Equal(t, "InstanceId", request.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", request.DimensionFilter[0].Value)
	})

	t.Run("Should parse parameters with multi-valued dimension filter", func(t *testing.T) {
		request, err := GetDimensionKeysRequest(map[string][]string{
			"region":           {"us-east-1"},
			"namespace":        {"AWS/EC2"},
			"metricName":       {"CPUUtilization"},
			"dimensionFilters": {"{\"InstanceId\": [\"i-1234567890abcdef0\", \"i-1234567890abcdef1\"]}"},
		})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
		assert.Equal(t, "CPUUtilization", request.MetricName)
		assert.Equal(t, 2, len(request.DimensionFilter))
		assert.Equal(t, "InstanceId", request.DimensionFilter[0].Name)
		assert.Equal(t, "i-1234567890abcdef0", request.DimensionFilter[0].Value)
		assert.Equal(t, "InstanceId", request.DimensionFilter[1].Name)
		assert.Equal(t, "i-1234567890abcdef1", request.DimensionFilter[1].Value)
	})

	t.Run("Should parse parameters with wildcard dimension filter", func(t *testing.T) {
		request, err := GetDimensionKeysRequest(map[string][]string{
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

	type testCase struct {
		name                 string
		dimensionKeysRequest DimensionKeysRequest
		expectedType         DimensionKeysRequestType
	}
	testCases := []testCase{
		{
			name: "With custom namespace it should resolve to FilterDimensionKeysRequest",
			dimensionKeysRequest: DimensionKeysRequest{
				Namespace: "custom",
			},
			expectedType: FilterDimensionKeysRequest,
		},
		{
			name: "With dimension filter it should resolve to FilterDimensionKeysRequest",
			dimensionKeysRequest: DimensionKeysRequest{
				Namespace:       "AWS/EC2",
				DimensionFilter: []*Dimension{{Name: "InstanceId", Value: "i-1234567890abcdef0"}},
			},
			expectedType: FilterDimensionKeysRequest,
		},
		{
			name: "With dimension filter and without custom namespace it should resolve to StandardDimensionKeysRequest",
			dimensionKeysRequest: DimensionKeysRequest{
				Namespace: "AWS/EC2",
			},
			expectedType: StandardDimensionKeysRequest,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expectedType, tc.dimensionKeysRequest.Type())
		})
	}
}

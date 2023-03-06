package resources

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricsRequest(t *testing.T) {
	t.Run("Should parse parameters", func(t *testing.T) {
		request, err := GetMetricsRequest(map[string][]string{"region": {"us-east-1"}, "namespace": {"AWS/EC2"}})
		require.NoError(t, err)
		assert.Equal(t, "us-east-1", request.Region)
		assert.Equal(t, "AWS/EC2", request.Namespace)
	})

	tests := []struct {
		reqType MetricsRequestType
		params  url.Values
	}{
		{
			params:  map[string][]string{"region": {"us-east-1"}, "namespace": {"AWS/EC2"}},
			reqType: MetricsByNamespaceRequestType,
		},
		{
			params:  map[string][]string{"region": {"us-east-1"}},
			reqType: AllMetricsRequestType,
		},
		{
			params:  map[string][]string{"region": {"us-east-1"}, "namespace": {""}},
			reqType: AllMetricsRequestType,
		},
		{
			params:  map[string][]string{"region": {"us-east-1"}, "namespace": {"custom-namespace"}},
			reqType: CustomNamespaceRequestType,
		},
	}

	for _, tc := range tests {
		t.Run("Should resolve the correct type", func(t *testing.T) {
			request, err := GetMetricsRequest(tc.params)
			require.NoError(t, err)
			assert.Equal(t, tc.reqType, request.Type())
		})
	}
}

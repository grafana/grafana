package appplugin

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestSubresourceMetricsRegistersWithEachRegistry(t *testing.T) {
	first, second := prometheus.NewRegistry(), prometheus.NewRegistry()
	registerSubresourceMetrics(first)
	registerSubresourceMetrics(second)
	registerSubresourceMetrics(first)
	newConnectMetric("resources", "metrics-test-app").Record()

	for _, reg := range []*prometheus.Registry{first, second} {
		count, err := testutil.GatherAndCount(reg,
			"grafana_app_apiserver_subresource_requests_total",
			"grafana_app_apiserver_subresource_request_duration_seconds")
		require.NoError(t, err)
		require.Equal(t, 2, count)
	}
}

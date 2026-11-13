package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestAPIRequestDurationIsNativeHistogram(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := NewAPIMetrics(reg)
	m.RequestDuration.WithLabelValues("GET", "/api/alerts", "200", GrafanaBackend).Observe(0.1)

	families, err := reg.Gather()
	require.NoError(t, err)

	const name = "grafana_alerting_request_duration_seconds"
	for _, mf := range families {
		if mf.GetName() != name {
			continue
		}
		require.NotEmpty(t, mf.GetMetric())
		// Schema is only set on the protobuf histogram when native buckets are enabled.
		require.NotNil(t, mf.GetMetric()[0].GetHistogram().Schema,
			"%s is not exposed as a native histogram", name)
		// The classic buckets must stay, so classic-only scrapers see no change.
		require.NotEmpty(t, mf.GetMetric()[0].GetHistogram().GetBucket(),
			"%s lost its classic buckets", name)
		return
	}
	t.Fatalf("metric %q not found", name)
}

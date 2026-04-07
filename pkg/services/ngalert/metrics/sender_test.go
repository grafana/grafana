package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSenderAggregatedMetrics_DescribeMetricNames(t *testing.T) {
	s := &Sender{registries: make(map[senderKey]*prometheus.Registry)}
	m := newSenderAggregatedMetrics(s)

	ch := make(chan *prometheus.Desc, 100)
	m.Describe(ch)
	close(ch)

	var names []string
	for desc := range ch {
		names = append(names, desc.String())
	}

	expectedNames := []string{
		"grafana_alerting_sender_alerts_latency_seconds",
		"grafana_alerting_sender_alerts_errors_total",
		"grafana_alerting_sender_alerts_sent_total",
		"grafana_alerting_sender_alerts_dropped_total",
		"grafana_alerting_sender_alerts_queue_length",
		"grafana_alerting_sender_alerts_queue_capacity",
		"grafana_alerting_sender_alertmanagers_discovered",
	}

	require.Len(t, names, len(expectedNames), "number of described metrics should match")

	for i, expected := range expectedNames {
		assert.Contains(t, names[i], "fqName: \""+expected+"\"",
			"metric at position %d should have name %s", i, expected)
	}
}

func TestSenderAggregatedMetrics_DescribeIncludesLabels(t *testing.T) {
	s := &Sender{registries: make(map[senderKey]*prometheus.Registry)}
	m := newSenderAggregatedMetrics(s)

	ch := make(chan *prometheus.Desc, 100)
	m.Describe(ch)
	close(ch)

	for desc := range ch {
		str := desc.String()
		assert.Contains(t, str, "org", "metric %s should have 'org' label", str)
		assert.Contains(t, str, "datasource_uid", "metric %s should have 'datasource_uid' label", str)
	}
}

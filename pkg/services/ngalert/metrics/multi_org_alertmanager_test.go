package metrics

import (
	"testing"

	"github.com/grafana/dskit/metrics"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAlertmanagerAggregatedMetrics_DescribeMetricNames(t *testing.T) {
	registries := metrics.NewTenantRegistries(log.NewNopLogger())
	m := NewAlertmanagerAggregatedMetrics(registries)

	ch := make(chan *prometheus.Desc, 100)
	m.Describe(ch)
	close(ch)

	var names []string
	for desc := range ch {
		names = append(names, desc.String())
	}

	expectedNames := []string{
		"grafana_alerting_alerts_received_total",
		"grafana_alerting_alerts_invalid_total",
		"grafana_alerting_alertmanager_receivers",
		"grafana_alerting_alertmanager_integrations",
		"grafana_alerting_alertmanager_inhibition_rules",
		"grafana_alerting_notifications_total",
		"grafana_alerting_notifications_failed_total",
		"grafana_alerting_notification_requests_total",
		"grafana_alerting_notification_requests_failed_total",
		"grafana_alerting_notification_latency_seconds",
		"grafana_alerting_nflog_gc_duration_seconds",
		"grafana_alerting_nflog_snapshot_duration_seconds",
		"grafana_alerting_nflog_snapshot_size_bytes",
		"grafana_alerting_nflog_queries_total",
		"grafana_alerting_nflog_query_errors_total",
		"grafana_alerting_nflog_query_duration_seconds",
		"grafana_alerting_nflog_gossip_messages_propagated_total",
		"grafana_alerting_alertmanager_alerts",
		"grafana_alerting_silences_gc_duration_seconds",
		"grafana_alerting_silences_snapshot_duration_seconds",
		"grafana_alerting_silences_snapshot_size_bytes",
		"grafana_alerting_silences_queries_total",
		"grafana_alerting_silences_query_errors_total",
		"grafana_alerting_silences_query_duration_seconds",
		"grafana_alerting_silences_gossip_messages_propagated_total",
		"grafana_alerting_silences",
		"grafana_alerting_dispatcher_aggregation_groups",
		"grafana_alerting_dispatcher_alert_processing_duration_seconds",
		"grafana_alerting_alertmanager_config_matchers",
		"grafana_alerting_alertmanager_config_match_re",
		"grafana_alerting_alertmanager_config_match",
		"grafana_alerting_alertmanager_config_object_matchers",
		"grafana_alerting_alertmanager_config_hash",
		"grafana_alerting_alertmanager_config_size_bytes",
	}

	require.Len(t, names, len(expectedNames), "number of described metrics should match")

	for i, expected := range expectedNames {
		assert.Contains(t, names[i], "fqName: \""+expected+"\"",
			"metric at position %d should have name %s", i, expected)
	}
}

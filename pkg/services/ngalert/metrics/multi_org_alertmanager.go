package metrics

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/dskit/metrics"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type MultiOrgAlertmanager struct {
	Registerer prometheus.Registerer
	registries *metrics.TenantRegistries

	ActiveConfigurations     prometheus.Gauge
	DiscoveredConfigurations prometheus.Gauge

	aggregatedMetrics *AlertmanagerAggregatedMetrics
}

func NewMultiOrgAlertmanagerMetrics(r prometheus.Registerer) *MultiOrgAlertmanager {
	registries := metrics.NewTenantRegistries(log.New("ngalert.multiorg.alertmanager.metrics")) // TODO: Should this be here? Probably not.
	moa := &MultiOrgAlertmanager{
		Registerer: r,
		registries: registries,
		DiscoveredConfigurations: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "discovered_configurations",
			Help:      "The number of organizations we've discovered that require an Alertmanager configuration.",
		}),
		ActiveConfigurations: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "active_configurations",
			Help:      "The number of active Alertmanager configurations.",
		}),
		aggregatedMetrics: NewAlertmanagerAggregatedMetrics(registries),
	}

	// These metrics use a different registration method as the struct itself represents a custom collector.
	// There's no way to "auto-register" a collector.
	r.MustRegister(moa.aggregatedMetrics)

	return moa
}

// RemoveOrgRegistry removes the *prometheus.Registry for the specified org. It is safe to call concurrently.
func (moa *MultiOrgAlertmanager) RemoveOrgRegistry(id int64) {
	moa.registries.RemoveTenantRegistry(strconv.FormatInt(id, 10), false)
}

// GetOrCreateOrgRegistry gets or creates a *prometheus.Registry for the specified org. It is safe to call concurrently.
func (moa *MultiOrgAlertmanager) GetOrCreateOrgRegistry(id int64) prometheus.Registerer {
	sid := strconv.FormatInt(id, 10)
	reg := moa.registries.GetRegistryForTenant(sid)
	if reg != nil {
		return reg
	}

	result := prometheus.NewRegistry()
	moa.registries.AddTenantRegistry(sid, result)

	return result
}

// AlertmanagerAggregatedMetrics are metrics collected directly from the registry.
// Unlike metrics.Alertmanager they are not called within this codebase hence the need for direct collection.
type AlertmanagerAggregatedMetrics struct {
	registries *metrics.TenantRegistries

	// metrics gather from the in-house "Alertmanager" directly.
	numReceivedAlerts         *prometheus.Desc
	numInvalidAlerts          *prometheus.Desc
	configuredReceivers       *prometheus.Desc
	configuredIntegrations    *prometheus.Desc
	configuredInhibitionRules *prometheus.Desc

	// exported metrics, gathered from Alertmanager PipelineBuilder
	numNotifications                   *prometheus.Desc
	numFailedNotifications             *prometheus.Desc
	numNotificationRequestsTotal       *prometheus.Desc
	numNotificationRequestsFailedTotal *prometheus.Desc
	notificationLatencySeconds         *prometheus.Desc

	// exported metrics, gathered from Alertmanager nflog
	nflogGCDuration              *prometheus.Desc
	nflogSnapshotDuration        *prometheus.Desc
	nflogSnapshotSize            *prometheus.Desc
	nflogQueriesTotal            *prometheus.Desc
	nflogQueryErrorsTotal        *prometheus.Desc
	nflogQueryDuration           *prometheus.Desc
	nflogPropagatedMessagesTotal *prometheus.Desc

	// exporter metrics, gathered from the Alertmanager Alert Marker.
	markerAlerts *prometheus.Desc

	// exported metrics, gathered from Alertmanager Silences
	silencesGCDuration              *prometheus.Desc
	silencesSnapshotDuration        *prometheus.Desc
	silencesSnapshotSize            *prometheus.Desc
	silencesQueriesTotal            *prometheus.Desc
	silencesQueryErrorsTotal        *prometheus.Desc
	silencesQueryDuration           *prometheus.Desc
	silences                        *prometheus.Desc
	silencesPropagatedMessagesTotal *prometheus.Desc

	// exported metrics, gathered from Alertmanager Dispatcher
	dispatchAggrGroups         *prometheus.Desc
	dispatchProcessingDuration *prometheus.Desc

	// added to measure usage of matchers, match_re, match and
	// object_matchers
	matchers       *prometheus.Desc
	matchRE        *prometheus.Desc
	match          *prometheus.Desc
	objectMatchers *prometheus.Desc

	configHash *prometheus.Desc
	configSize *prometheus.Desc
}

func NewAlertmanagerAggregatedMetrics(registries *metrics.TenantRegistries) *AlertmanagerAggregatedMetrics {
	aggregatedMetrics := &AlertmanagerAggregatedMetrics{
		registries: registries,

		numReceivedAlerts: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alerts_received_total", Namespace, Subsystem),
			"The total number of received alerts.",
			[]string{"org", "status"}, nil),
		numInvalidAlerts: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alerts_invalid_total", Namespace, Subsystem),
			"The total number of received alerts that were invalid.",
			[]string{"org"}, nil),
		configuredReceivers: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_receivers", Namespace, Subsystem),
			"Number of configured receivers by state. It is considered active if used within a route.",
			[]string{"org", "state"}, nil),
		configuredIntegrations: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_integrations", Namespace, Subsystem),
			"Number of configured receivers.",
			[]string{"org", "type"}, nil),
		configuredInhibitionRules: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_inhibition_rules", Namespace, Subsystem),
			"Number of configured inhibition rules.",
			[]string{"org"}, nil),

		numNotifications: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_notifications_total", Namespace, Subsystem),
			"The total number of attempted notifications.",
			[]string{"org", "integration"}, nil),
		numFailedNotifications: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_notifications_failed_total", Namespace, Subsystem),
			"The total number of failed notifications.",
			[]string{"org", "integration"}, nil),
		numNotificationRequestsTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_notification_requests_total", Namespace, Subsystem),
			"The total number of attempted notification requests.",
			[]string{"org", "integration"}, nil),
		numNotificationRequestsFailedTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_notification_requests_failed_total", Namespace, Subsystem),
			"The total number of failed notification requests.",
			[]string{"org", "integration"}, nil),
		notificationLatencySeconds: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_notification_latency_seconds", Namespace, Subsystem),
			"The latency of notifications in seconds.",
			nil, nil),

		nflogGCDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_gc_duration_seconds", Namespace, Subsystem),
			"Duration of the last notification log garbage collection cycle.",
			nil, nil),
		nflogSnapshotDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_snapshot_duration_seconds", Namespace, Subsystem),
			"Duration of the last notification log snapshot.",
			nil, nil),
		nflogSnapshotSize: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_snapshot_size_bytes", Namespace, Subsystem),
			"Size of the last notification log snapshot in bytes.",
			nil, nil),
		nflogQueriesTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_queries_total", Namespace, Subsystem),
			"Number of notification log queries were received.",
			nil, nil),
		nflogQueryErrorsTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_query_errors_total", Namespace, Subsystem),
			"Number notification log received queries that failed.",
			nil, nil),
		nflogQueryDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_query_duration_seconds", Namespace, Subsystem),
			"Duration of notification log query evaluation.",
			nil, nil),
		nflogPropagatedMessagesTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_nflog_gossip_messages_propagated_total", Namespace, Subsystem),
			"Number of received gossip messages that have been further gossiped.",
			nil, nil),

		markerAlerts: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_alerts", Namespace, Subsystem),
			"How many alerts by state are in Grafana's Alertmanager.",
			[]string{"org", "state"}, nil),

		silencesGCDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_gc_duration_seconds", Namespace, Subsystem),
			"Duration of the last silence garbage collection cycle.",
			nil, nil),
		silencesSnapshotDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_snapshot_duration_seconds", Namespace, Subsystem),
			"Duration of the last silence snapshot.",
			nil, nil),
		silencesSnapshotSize: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_snapshot_size_bytes", Namespace, Subsystem),
			"Size of the last silence snapshot in bytes.",
			nil, nil),
		silencesQueriesTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_queries_total", Namespace, Subsystem),
			"How many silence queries were received.",
			nil, nil),
		silencesQueryErrorsTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_query_errors_total", Namespace, Subsystem),
			"How many silence received queries did not succeed.",
			nil, nil),
		silencesQueryDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_query_duration_seconds", Namespace, Subsystem),
			"Duration of silence query evaluation.",
			nil, nil),
		silencesPropagatedMessagesTotal: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences_gossip_messages_propagated_total", Namespace, Subsystem),
			"Number of received gossip messages that have been further gossiped.",
			nil, nil),
		silences: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_silences", Namespace, Subsystem),
			"How many silences by state.",
			[]string{"org", "state"}, nil),

		dispatchAggrGroups: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_dispatcher_aggregation_groups", Namespace, Subsystem),
			"Number of active aggregation groups",
			nil, nil),
		dispatchProcessingDuration: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_dispatcher_alert_processing_duration_seconds", Namespace, Subsystem),
			"Summary of latencies for the processing of alerts.",
			nil, nil),

		matchers: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_config_matchers", Namespace, Subsystem),
			"The total number of matchers",
			nil, nil),
		matchRE: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_config_match_re", Namespace, Subsystem),
			"The total number of matchRE",
			nil, nil),
		match: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_config_match", Namespace, Subsystem),
			"The total number of match",
			nil, nil),
		objectMatchers: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_config_object_matchers", Namespace, Subsystem),
			"The total number of object_matchers",
			nil, nil),

		configHash: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_config_hash", Namespace, Subsystem),
			"The hash of the Alertmanager configuration.",
			[]string{"org"}, nil),

		configSize: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_alertmanager_config_size_bytes", Namespace, Subsystem),
			"The size of the grafana alertmanager configuration in bytes",
			[]string{"org"}, nil),
	}

	return aggregatedMetrics
}

func (a *AlertmanagerAggregatedMetrics) Describe(out chan<- *prometheus.Desc) {
	out <- a.numReceivedAlerts
	out <- a.numInvalidAlerts
	out <- a.configuredReceivers
	out <- a.configuredIntegrations
	out <- a.configuredInhibitionRules

	out <- a.numNotifications
	out <- a.numFailedNotifications
	out <- a.numNotificationRequestsTotal
	out <- a.numNotificationRequestsFailedTotal
	out <- a.notificationLatencySeconds

	out <- a.nflogGCDuration
	out <- a.nflogSnapshotDuration
	out <- a.nflogSnapshotSize
	out <- a.nflogQueriesTotal
	out <- a.nflogQueryErrorsTotal
	out <- a.nflogQueryDuration
	out <- a.nflogPropagatedMessagesTotal

	out <- a.markerAlerts

	out <- a.silencesGCDuration
	out <- a.silencesSnapshotDuration
	out <- a.silencesSnapshotSize
	out <- a.silencesQueriesTotal
	out <- a.silencesQueryErrorsTotal
	out <- a.silencesQueryDuration
	out <- a.silencesPropagatedMessagesTotal
	out <- a.silences

	out <- a.dispatchAggrGroups
	out <- a.dispatchProcessingDuration

	out <- a.matchers
	out <- a.matchRE
	out <- a.match
	out <- a.objectMatchers

	out <- a.configHash
	out <- a.configSize
}

func (a *AlertmanagerAggregatedMetrics) Collect(out chan<- prometheus.Metric) {
	data := a.registries.BuildMetricFamiliesPerTenant()

	data.SendSumOfCountersPerTenant(out, a.numReceivedAlerts, "alertmanager_alerts_received_total", metrics.WithLabels("status"))
	data.SendSumOfCountersPerTenant(out, a.numInvalidAlerts, "alertmanager_alerts_invalid_total")
	data.SendSumOfGaugesPerTenant(out, a.configuredReceivers, "grafana_alerting_alertmanager_receivers", metrics.WithLabels("state"))
	data.SendSumOfGaugesPerTenant(out, a.configuredIntegrations, "grafana_alerting_alertmanager_integrations", metrics.WithLabels("type"))
	data.SendSumOfGaugesPerTenant(out, a.configuredInhibitionRules, "grafana_alerting_alertmanager_inhibition_rules")

	data.SendSumOfCountersPerTenant(out, a.numNotifications, "alertmanager_notifications_total", metrics.WithLabels("integration"), metrics.WithSkipZeroValueMetrics)
	data.SendSumOfCountersPerTenant(out, a.numFailedNotifications, "alertmanager_notifications_failed_total", metrics.WithLabels("integration"), metrics.WithSkipZeroValueMetrics)
	data.SendSumOfCountersPerTenant(out, a.numNotificationRequestsTotal, "alertmanager_notification_requests_total", metrics.WithLabels("integration"), metrics.WithSkipZeroValueMetrics)
	data.SendSumOfCountersPerTenant(out, a.numNotificationRequestsFailedTotal, "alertmanager_notification_requests_failed_total", metrics.WithLabels("integration"), metrics.WithSkipZeroValueMetrics)
	data.SendSumOfHistograms(out, a.notificationLatencySeconds, "alertmanager_notification_latency_seconds")

	data.SendSumOfSummaries(out, a.nflogGCDuration, "alertmanager_nflog_gc_duration_seconds")
	data.SendSumOfSummaries(out, a.nflogSnapshotDuration, "alertmanager_nflog_snapshot_duration_seconds")
	data.SendSumOfGauges(out, a.nflogSnapshotSize, "alertmanager_nflog_snapshot_size_bytes")
	data.SendSumOfCounters(out, a.nflogQueriesTotal, "alertmanager_nflog_queries_total")
	data.SendSumOfCounters(out, a.nflogQueryErrorsTotal, "alertmanager_nflog_query_errors_total")
	data.SendSumOfHistograms(out, a.nflogQueryDuration, "alertmanager_nflog_query_duration_seconds")
	data.SendSumOfCounters(out, a.nflogPropagatedMessagesTotal, "alertmanager_nflog_gossip_messages_propagated_total")

	data.SendSumOfGaugesPerTenant(out, a.markerAlerts, "alertmanager_alerts", metrics.WithLabels("state"))

	data.SendSumOfSummaries(out, a.silencesGCDuration, "alertmanager_silences_gc_duration_seconds")
	data.SendSumOfSummaries(out, a.silencesSnapshotDuration, "alertmanager_silences_snapshot_duration_seconds")
	data.SendSumOfGauges(out, a.silencesSnapshotSize, "alertmanager_silences_snapshot_size_bytes")
	data.SendSumOfCounters(out, a.silencesQueriesTotal, "alertmanager_silences_queries_total")
	data.SendSumOfCounters(out, a.silencesQueryErrorsTotal, "alertmanager_silences_query_errors_total")
	data.SendSumOfHistograms(out, a.silencesQueryDuration, "alertmanager_silences_query_duration_seconds")
	data.SendSumOfCounters(out, a.silencesPropagatedMessagesTotal, "alertmanager_silences_gossip_messages_propagated_total")
	data.SendSumOfGaugesPerTenant(out, a.silences, "alertmanager_silences", metrics.WithLabels("state"))

	data.SendSumOfGauges(out, a.dispatchAggrGroups, "alertmanager_dispatcher_aggregation_groups")
	data.SendSumOfSummaries(out, a.dispatchProcessingDuration, "alertmanager_dispatcher_alert_processing_duration_seconds")

	data.SendSumOfGauges(out, a.matchers, "alertmanager_config_matchers")
	data.SendSumOfGauges(out, a.matchRE, "alertmanager_config_match_re")
	data.SendSumOfGauges(out, a.match, "alertmanager_config_match")
	data.SendSumOfGauges(out, a.objectMatchers, "alertmanager_config_object_matchers")

	data.SendMaxOfGaugesPerTenant(out, a.configHash, "alertmanager_config_hash")
	data.SendMaxOfGaugesPerTenant(out, a.configSize, "alertmanager_config_size_bytes")
}

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
	registries := metrics.NewTenantRegistries(log.New("ngalert.multiorg.alertmanager.metrics")) //TODO: Should this be here? Probably not.
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

	// exported metrics, gathered from Alertmanager Silences
	silencesGCDuration              *prometheus.Desc
	silencesSnapshotDuration        *prometheus.Desc
	silencesSnapshotSize            *prometheus.Desc
	silencesQueriesTotal            *prometheus.Desc
	silencesQueryErrorsTotal        *prometheus.Desc
	silencesQueryDuration           *prometheus.Desc
	silences                        *prometheus.Desc
	silencesPropagatedMessagesTotal *prometheus.Desc
}

func NewAlertmanagerAggregatedMetrics(registries *metrics.TenantRegistries) *AlertmanagerAggregatedMetrics {
	aggregatedMetrics := &AlertmanagerAggregatedMetrics{
		registries: registries,

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
	}

	return aggregatedMetrics
}

func (a *AlertmanagerAggregatedMetrics) Describe(out chan<- *prometheus.Desc) {
	out <- a.silencesGCDuration
	out <- a.silencesSnapshotDuration
	out <- a.silencesSnapshotSize
	out <- a.silencesQueriesTotal
	out <- a.silencesQueryErrorsTotal
	out <- a.silencesQueryDuration
	out <- a.silencesPropagatedMessagesTotal
	out <- a.silences
}

func (a *AlertmanagerAggregatedMetrics) Collect(out chan<- prometheus.Metric) {
	data := a.registries.BuildMetricFamiliesPerTenant()

	data.SendSumOfSummaries(out, a.silencesGCDuration, "alertmanager_silences_gc_duration_seconds")
	data.SendSumOfSummaries(out, a.silencesSnapshotDuration, "alertmanager_silences_snapshot_duration_seconds")
	data.SendSumOfGauges(out, a.silencesSnapshotSize, "alertmanager_silences_snapshot_size_bytes")
	data.SendSumOfCounters(out, a.silencesQueriesTotal, "alertmanager_silences_queries_total")
	data.SendSumOfCounters(out, a.silencesQueryErrorsTotal, "alertmanager_silences_query_errors_total")
	data.SendSumOfHistograms(out, a.silencesQueryDuration, "alertmanager_silences_query_duration_seconds")
	data.SendSumOfCounters(out, a.silencesPropagatedMessagesTotal, "alertmanager_silences_gossip_messages_propagated_total")
	data.SendSumOfGaugesPerTenantWithLabels(out, a.silences, "alertmanager_silences", "state")
}

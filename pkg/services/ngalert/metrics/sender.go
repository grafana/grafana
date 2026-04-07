package metrics

import (
	"fmt"
	"strconv"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

// senderKey identifies a per-datasource sender registry.
type senderKey struct {
	orgID         int64
	datasourceUID string
}

// Sender manages per-datasource metrics for the external Alertmanager sender.
// Each (org, datasource) pair gets its own prometheus.Registry. A custom collector
// aggregates them into grafana_alerting_sender_* metrics with org and datasource_uid labels.
type Sender struct {
	mu         sync.RWMutex
	registries map[senderKey]*prometheus.Registry
}

// NewSenderMetrics creates a new Sender metrics manager and registers the aggregated collector on r.
func NewSenderMetrics(r prometheus.Registerer) *Sender {
	s := &Sender{
		registries: make(map[senderKey]*prometheus.Registry),
	}
	r.MustRegister(newSenderAggregatedMetrics(s))
	return s
}

// GetOrCreateRegistry gets or creates a *prometheus.Registry for the specified org and datasource. It is safe to call concurrently.
func (s *Sender) GetOrCreateRegistry(orgID int64, datasourceUID string) prometheus.Registerer {
	key := senderKey{orgID: orgID, datasourceUID: datasourceUID}
	s.mu.Lock()
	defer s.mu.Unlock()
	if reg, ok := s.registries[key]; ok {
		return reg
	}
	reg := prometheus.NewRegistry()
	s.registries[key] = reg
	return reg
}

// RemoveRegistry removes the *prometheus.Registry for the specified org and datasource. It is safe to call concurrently.
func (s *Sender) RemoveRegistry(orgID int64, datasourceUID string) {
	key := senderKey{orgID: orgID, datasourceUID: datasourceUID}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.registries, key)
}

// senderAggregatedMetrics is a custom collector that aggregates per-datasource sender metrics
// into grafana_alerting_sender_* metrics with "org" and "datasource_uid" labels.
type senderAggregatedMetrics struct {
	sender *Sender

	alertsLatency             *prometheus.Desc
	alertsErrors              *prometheus.Desc
	alertsSent                *prometheus.Desc
	alertsDropped             *prometheus.Desc
	alertsQueueLength         *prometheus.Desc
	alertsQueueCapacity       *prometheus.Desc
	alertmanagersDiscovered   *prometheus.Desc
}

var senderLabels = []string{"org", "datasource_uid"}

func newSenderAggregatedMetrics(s *Sender) *senderAggregatedMetrics {
	return &senderAggregatedMetrics{
		sender: s,
		alertsLatency: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alerts_latency_seconds", Namespace, Subsystem),
			"Latency quantiles for sending alerts to external Alertmanagers.",
			senderLabels, nil),
		alertsErrors: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alerts_errors_total", Namespace, Subsystem),
			"Total number of alerts affected by errors when sending to external Alertmanagers.",
			senderLabels, nil),
		alertsSent: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alerts_sent_total", Namespace, Subsystem),
			"Total number of alerts sent to external Alertmanagers.",
			senderLabels, nil),
		alertsDropped: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alerts_dropped_total", Namespace, Subsystem),
			"Total number of alerts dropped due to errors when sending to external Alertmanagers.",
			senderLabels, nil),
		alertsQueueLength: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alerts_queue_length", Namespace, Subsystem),
			"The number of alerts in the sender queue.",
			senderLabels, nil),
		alertsQueueCapacity: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alerts_queue_capacity", Namespace, Subsystem),
			"The capacity of the sender alerts queue.",
			senderLabels, nil),
		alertmanagersDiscovered: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alertmanagers_discovered", Namespace, Subsystem),
			"The number of external alertmanagers discovered and active.",
			senderLabels, nil),
	}
}

func (m *senderAggregatedMetrics) Describe(out chan<- *prometheus.Desc) {
	out <- m.alertsLatency
	out <- m.alertsErrors
	out <- m.alertsSent
	out <- m.alertsDropped
	out <- m.alertsQueueLength
	out <- m.alertsQueueCapacity
	out <- m.alertmanagersDiscovered
}

func (m *senderAggregatedMetrics) Collect(out chan<- prometheus.Metric) {
	m.sender.mu.RLock()
	defer m.sender.mu.RUnlock()

	for key, reg := range m.sender.registries {
		families, err := reg.Gather()
		if err != nil {
			continue
		}

		labels := []string{strconv.FormatInt(key.orgID, 10), key.datasourceUID}

		for _, fam := range families {
			switch fam.GetName() {
			case "prometheus_notifications_errors_total":
				out <- prometheus.MustNewConstMetric(m.alertsErrors, prometheus.CounterValue, sumCounter(fam), labels...)
			case "prometheus_notifications_sent_total":
				out <- prometheus.MustNewConstMetric(m.alertsSent, prometheus.CounterValue, sumCounter(fam), labels...)
			case "prometheus_notifications_dropped_total":
				out <- prometheus.MustNewConstMetric(m.alertsDropped, prometheus.CounterValue, sumCounter(fam), labels...)
			case "prometheus_notifications_queue_length":
				out <- prometheus.MustNewConstMetric(m.alertsQueueLength, prometheus.GaugeValue, sumGauge(fam), labels...)
			case "prometheus_notifications_queue_capacity":
				out <- prometheus.MustNewConstMetric(m.alertsQueueCapacity, prometheus.GaugeValue, sumGauge(fam), labels...)
			case "prometheus_notifications_alertmanagers_discovered":
				out <- prometheus.MustNewConstMetric(m.alertmanagersDiscovered, prometheus.GaugeValue, sumGauge(fam), labels...)
			case "prometheus_notifications_latency_seconds":
				collectSummary(out, m.alertsLatency, fam, labels)
			}
		}
	}
}

// sumCounter sums all counter values in a metric family.
func sumCounter(fam *dto.MetricFamily) float64 {
	var sum float64
	for _, m := range fam.GetMetric() {
		if c := m.GetCounter(); c != nil {
			sum += c.GetValue()
		}
	}
	return sum
}

// sumGauge sums all gauge values in a metric family.
func sumGauge(fam *dto.MetricFamily) float64 {
	var sum float64
	for _, m := range fam.GetMetric() {
		if g := m.GetGauge(); g != nil {
			sum += g.GetValue()
		}
	}
	return sum
}

// collectSummary emits a const summary metric from the gathered summary family.
func collectSummary(out chan<- prometheus.Metric, desc *prometheus.Desc, fam *dto.MetricFamily, labels []string) {
	for _, m := range fam.GetMetric() {
		s := m.GetSummary()
		if s == nil {
			continue
		}
		quantiles := make(map[float64]float64, len(s.GetQuantile()))
		for _, q := range s.GetQuantile() {
			quantiles[q.GetQuantile()] = q.GetValue()
		}
		out <- prometheus.MustNewConstSummary(desc, s.GetSampleCount(), s.GetSampleSum(), quantiles, labels...)
	}
}

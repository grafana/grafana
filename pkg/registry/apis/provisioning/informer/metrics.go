package informer

import (
	sdkmetrics "github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/prometheus/client_golang/prometheus"

	usresource "github.com/grafana/grafana/pkg/storage/unified/resource"
)

// metricsNamespace prefixes every collector this package builds, so the app-sdk's series stay findable alongside
// the rest of provisioning's.
const metricsNamespace = "grafana_provisioning"

// Metrics are the collectors a process's informers report on. Delivery is shared by every shape — bus, periodic and
// the apiserver-backed watch — so a kind keeps its series when its source changes; Bus adds what only a bus informer
// has, its subscription state and reconnects.
type Metrics struct {
	Delivery *operator.InformerDeliveryMetrics
	Bus      *operator.BusInformerMetrics
}

// NewMetrics builds the informers' collectors under this repository's prefix, registering as it builds. Building a
// second set on the same registry reuses the collectors already there rather than failing.
func NewMetrics(reg prometheus.Registerer) Metrics {
	// Unified storage embeds the write's timestamp in the resource version, which is what dates a change for the
	// delivery latency histograms and turns a version difference into a lag in seconds.
	cfg := sdkmetrics.Config{Namespace: metricsNamespace}
	delivery := operator.NewInformerDeliveryMetrics(operator.InformerDeliveryMetricsConfig{
		MetricsConfig:       cfg,
		Registerer:          reg,
		ResourceVersionTime: usresource.ResourceVersionTime,
	})
	return Metrics{
		Delivery: delivery,
		Bus: operator.NewBusInformerMetrics(operator.BusInformerMetricsConfig{
			MetricsConfig: cfg,
			Registerer:    reg,
			Delivery:      delivery,
		}),
	}
}

// NewFreshnessMetrics builds the read-freshness collectors, which only a bus-backed source reports on: an apiserver
// watch keeps a cache current, so there is no cross-replica read visibility to measure.
func NewFreshnessMetrics(reg prometheus.Registerer) *operator.FreshnessMetrics {
	return operator.NewFreshnessMetrics(operator.FreshnessMetricsConfig{
		MetricsConfig:       sdkmetrics.Config{Namespace: metricsNamespace},
		Registerer:          reg,
		ResourceVersionTime: usresource.ResourceVersionTime,
	})
}

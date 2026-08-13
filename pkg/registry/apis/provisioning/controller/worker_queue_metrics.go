package controller

import (
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/util/workqueue"
)

// workerQueueWaitBuckets mirrors the job queue's grafana_provisioning_jobs_queue_wait_seconds
// buckets so controller and job-driver queue latencies are directly comparable on the same
// dashboards.
var workerQueueWaitBuckets = []float64{1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0}

// newWorkerQueueWaitProvider registers a per-replica histogram named
// grafana_provisioning_<component>_worker_queue_wait_seconds and returns a
// workqueue.MetricsProvider that feeds only the queue's latency observations into it. The
// workqueue records when a key first enters the queue and observes the elapsed time when a
// worker picks it up, so coalesced re-adds are measured from the first enqueue — the true
// backlog wait. Every other workqueue metric is a no-op: queue depth is already exposed as a
// scrape-time GaugeFunc, and the rest are not needed here.
//
// The provider must be non-empty (a name is set on the queue config) or client-go falls back
// to its no-op metrics and never records the latency.
func newWorkerQueueWaitProvider(registry prometheus.Registerer, component string) workqueue.MetricsProvider {
	waitTime := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_" + component + "_worker_queue_wait_seconds",
		Help:    "Time " + component + " keys spend waiting in this replica's local work queue before a worker picks them up",
		Buckets: workerQueueWaitBuckets,
	})
	registry.MustRegister(waitTime)
	return workerQueueWaitMetricsProvider{latency: waitTime}
}

// workerQueueWaitMetricsProvider implements workqueue.MetricsProvider, wiring only the
// queue-latency histogram and no-opping every other workqueue metric.
type workerQueueWaitMetricsProvider struct {
	latency prometheus.Histogram
}

func (p workerQueueWaitMetricsProvider) NewLatencyMetric(string) workqueue.HistogramMetric {
	return p.latency
}

func (workerQueueWaitMetricsProvider) NewDepthMetric(string) workqueue.GaugeMetric {
	return noopWorkqueueMetric{}
}

func (workerQueueWaitMetricsProvider) NewAddsMetric(string) workqueue.CounterMetric {
	return noopWorkqueueMetric{}
}

func (workerQueueWaitMetricsProvider) NewWorkDurationMetric(string) workqueue.HistogramMetric {
	return noopWorkqueueMetric{}
}

func (workerQueueWaitMetricsProvider) NewUnfinishedWorkSecondsMetric(string) workqueue.SettableGaugeMetric {
	return noopWorkqueueMetric{}
}

func (workerQueueWaitMetricsProvider) NewLongestRunningProcessorSecondsMetric(string) workqueue.SettableGaugeMetric {
	return noopWorkqueueMetric{}
}

func (workerQueueWaitMetricsProvider) NewRetriesMetric(string) workqueue.CounterMetric {
	return noopWorkqueueMetric{}
}

// noopWorkqueueMetric satisfies every workqueue metric interface without recording anything.
type noopWorkqueueMetric struct{}

func (noopWorkqueueMetric) Inc()            {}
func (noopWorkqueueMetric) Dec()            {}
func (noopWorkqueueMetric) Set(float64)     {}
func (noopWorkqueueMetric) Observe(float64) {}

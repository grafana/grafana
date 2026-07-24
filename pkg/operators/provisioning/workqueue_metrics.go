package provisioning

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/util/workqueue"
)

// workqueueOnce guards the process-global workqueue.SetProvider: client-go reads
// the provider once, when a queue is constructed, so it must be set before the
// controllers build their queues and only needs setting once per process.
var workqueueOnce sync.Once

// registerWorkqueueMetrics wires a Prometheus provider into client-go so the
// controllers' named rate-limiting workqueues
// (provisioningRepositoryController, provisioningConnectionController) emit the
// standard workqueue_* metrics — depth, adds, retries, queue/work duration — which
// give queue backlog and per-item processing/wait latency without scraping logs.
//
// It is registered only in the standalone provisioning operators, whose sole
// workqueues are the provisioning controllers'; the single-binary path does not
// call it, to avoid overriding the global provider for unrelated controllers.
func registerWorkqueueMetrics(reg prometheus.Registerer) {
	workqueueOnce.Do(func() {
		workqueue.SetProvider(newWorkqueueMetricsProvider(reg))
	})
}

// durationBuckets mirrors client-go/component-base's workqueue histograms
// (10ns→100s) so the series match what dashboards and other controllers expect.
var durationBuckets = prometheus.ExponentialBuckets(10e-9, 10, 10)

type workqueueMetricsProvider struct {
	depth          *prometheus.GaugeVec
	adds           *prometheus.CounterVec
	latency        *prometheus.HistogramVec
	workDuration   *prometheus.HistogramVec
	unfinished     *prometheus.GaugeVec
	longestRunning *prometheus.GaugeVec
	retries        *prometheus.CounterVec
}

func newWorkqueueMetricsProvider(reg prometheus.Registerer) *workqueueMetricsProvider {
	p := &workqueueMetricsProvider{
		depth: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Subsystem: "workqueue",
			Name:      "depth",
			Help:      "Current depth of the workqueue.",
		}, []string{"name"}),
		adds: prometheus.NewCounterVec(prometheus.CounterOpts{
			Subsystem: "workqueue",
			Name:      "adds_total",
			Help:      "Total number of adds handled by the workqueue.",
		}, []string{"name"}),
		latency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Subsystem: "workqueue",
			Name:      "queue_duration_seconds",
			Help:      "How long in seconds an item stays in the workqueue before being processed.",
			Buckets:   durationBuckets,
		}, []string{"name"}),
		workDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Subsystem: "workqueue",
			Name:      "work_duration_seconds",
			Help:      "How long in seconds processing an item from the workqueue takes.",
			Buckets:   durationBuckets,
		}, []string{"name"}),
		unfinished: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Subsystem: "workqueue",
			Name:      "unfinished_work_seconds",
			Help:      "How many seconds of work has been done that is in progress and hasn't been observed by work_duration.",
		}, []string{"name"}),
		longestRunning: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Subsystem: "workqueue",
			Name:      "longest_running_processor_seconds",
			Help:      "How many seconds the longest running processor for the workqueue has been running.",
		}, []string{"name"}),
		retries: prometheus.NewCounterVec(prometheus.CounterOpts{
			Subsystem: "workqueue",
			Name:      "retries_total",
			Help:      "Total number of retries handled by the workqueue.",
		}, []string{"name"}),
	}
	reg.MustRegister(p.depth, p.adds, p.latency, p.workDuration, p.unfinished, p.longestRunning, p.retries)
	return p
}

func (p *workqueueMetricsProvider) NewDepthMetric(name string) workqueue.GaugeMetric {
	return p.depth.WithLabelValues(name)
}

func (p *workqueueMetricsProvider) NewAddsMetric(name string) workqueue.CounterMetric {
	return p.adds.WithLabelValues(name)
}

func (p *workqueueMetricsProvider) NewLatencyMetric(name string) workqueue.HistogramMetric {
	return p.latency.WithLabelValues(name)
}

func (p *workqueueMetricsProvider) NewWorkDurationMetric(name string) workqueue.HistogramMetric {
	return p.workDuration.WithLabelValues(name)
}

func (p *workqueueMetricsProvider) NewUnfinishedWorkSecondsMetric(name string) workqueue.SettableGaugeMetric {
	return p.unfinished.WithLabelValues(name)
}

func (p *workqueueMetricsProvider) NewLongestRunningProcessorSecondsMetric(name string) workqueue.SettableGaugeMetric {
	return p.longestRunning.WithLabelValues(name)
}

func (p *workqueueMetricsProvider) NewRetriesMetric(name string) workqueue.CounterMetric {
	return p.retries.WithLabelValues(name)
}

var _ workqueue.MetricsProvider = (*workqueueMetricsProvider)(nil)

package jobs

import (
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	"github.com/prometheus/client_golang/prometheus"
)

type JobMetrics struct {
	registry       prometheus.Registerer
	processedTotal *prometheus.CounterVec
	durationHist   *prometheus.HistogramVec
}

type QueueMetrics struct {
	queueSize     *prometheus.GaugeVec
	queueWaitTime *prometheus.HistogramVec
}

func RegisterQueueMetrics(registry prometheus.Registerer) QueueMetrics {
	queueSize := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_jobs_queue_size",
			Help: "Number of jobs currently in the queue",
		},
		[]string{"action"},
	)
	registry.MustRegister(queueSize)

	queueWaitTime := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_queue_wait_seconds",
			Help:    "Time jobs spend waiting in the queue before being claimed",
			Buckets: []float64{1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0},
		},
		[]string{"action"},
	)
	registry.MustRegister(queueWaitTime)

	return QueueMetrics{
		queueSize:     queueSize,
		queueWaitTime: queueWaitTime,
	}
}

func (m *QueueMetrics) IncreaseQueueSize(action string) {
	m.queueSize.WithLabelValues(action).Inc()
}

func (m *QueueMetrics) DecreaseQueueSize(action string) {
	m.queueSize.WithLabelValues(action).Dec()
}

func (m *QueueMetrics) RecordWaitTime(action string, waitSeconds float64) {
	m.queueWaitTime.WithLabelValues(action).Observe(waitSeconds)
}

func RegisterJobMetrics(registry prometheus.Registerer) JobMetrics {
	processedTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_jobs_processed_total",
			Help: "Total number of jobs processed",
		},
		[]string{"action", "outcome"},
	)
	registry.MustRegister(processedTotal)

	durationHist := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_jobs_duration_seconds",
			Help:    "Duration of job",
			Buckets: []float64{5.0, 10.0, 30.0, 60.0, 120.0, 300.0},
		},
		[]string{"action", "resources_changed_bucket"},
	)
	registry.MustRegister(durationHist)

	return JobMetrics{
		registry:       registry,
		processedTotal: processedTotal,
		durationHist:   durationHist,
	}
}

func (m *JobMetrics) RecordJob(jobAction string, outcome string, resourceCountChanged int, duration float64) {
	m.processedTotal.WithLabelValues(jobAction, outcome).Inc()

	// only record duration when the job was successful. otherwise resource count will be incorrect
	if outcome == utils.SuccessOutcome {
		m.durationHist.WithLabelValues(jobAction, utils.GetResourceCountBucket(resourceCountChanged)).Observe(duration)
	}
}

func recordConcurrentDriverMetric(registry prometheus.Registerer, numDrivers int) {
	concurrentDriver := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "grafana_provisioning_jobs_concurrent_driver_num_drivers",
			Help: "Number of concurrent job drivers",
		},
		[]string{},
	)
	registry.MustRegister(concurrentDriver)
	concurrentDriver.WithLabelValues().Set(float64(numDrivers))
}

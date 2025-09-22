package jobs

import "github.com/prometheus/client_golang/prometheus"

const (
	SuccessOutcome = "success"
	ErrorOutcome   = "error"
)

type JobMetrics struct {
	registry       prometheus.Registerer
	processedTotal *prometheus.CounterVec
	durationHist   *prometheus.HistogramVec
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
	if outcome == SuccessOutcome {
		m.durationHist.WithLabelValues(jobAction, getResourceCountBucket(resourceCountChanged)).Observe(duration)
	}
}

func getResourceCountBucket(count int) string {
	switch {
	case count == 0:
		return "0"
	case count <= 10:
		return "1-10"
	case count <= 50:
		return "11-50"
	case count <= 100:
		return "51-100"
	case count <= 500:
		return "101-500"
	case count <= 1000:
		return "501-1000"
	default:
		return "1000+"
	}
}

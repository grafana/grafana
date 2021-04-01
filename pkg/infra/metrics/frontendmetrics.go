package metrics

import "github.com/prometheus/client_golang/prometheus"

// PostPostFrontendMetricsCommand sent by frontend to record frontend metrics
type PostFrontendMetricsCommand struct {
	Events []FrontendMetricEvent `json:"events"`
}

// FrontendMetricEvent a single metric measurement event
type FrontendMetricEvent struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

// FrontendMetricsRecorder handles the recording of the event, ie passes it to a prometheus metric
type FrontendMetricsRecorder func(event FrontendMetricEvent)

// MFrontendLoadTime is a metric summary of alert execution duration
var FrontendMetrics map[string]FrontendMetricsRecorder

func initFrontendMetrics() {
	objectiveMap := map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001}

	loadTimeName := "frontend_boot_load_time_milliseconds"
	loadTime := prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       loadTimeName,
		Help:       "Summary of frontend app boot load time",
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	FrontendMetrics = map[string]FrontendMetricsRecorder{
		loadTimeName: func(event FrontendMetricEvent) {
			loadTime.Observe(event.Value)
		},
	}

	prometheus.MustRegister(loadTime)
}

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
var FrontendMetrics map[string]FrontendMetricsRecorder = map[string]FrontendMetricsRecorder{}

func registerFrontendSummary(name string, help string) {
	objectiveMap := map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001}

	summary := prometheus.NewSummary(prometheus.SummaryOpts{
		Name:       name,
		Help:       help,
		Objectives: objectiveMap,
		Namespace:  ExporterName,
	})

	FrontendMetrics[name] = func(event FrontendMetricEvent) {
		summary.Observe(event.Value)
	}

	prometheus.MustRegister(summary)
}

func initFrontendMetrics() {
	registerFrontendSummary("frontend_boot_load_time_milliseconds", "Frontend boot time measurement")
	registerFrontendSummary("frontend_boot_first_paint_time_milliseconds", "Frontend boot first paint")
	registerFrontendSummary("frontend_boot_js_done_time_milliseconds", "Frontend boot initial js load")
}

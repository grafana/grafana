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

// FrontendMetrics contains all the valid frontend metrics and a handler function for recording events
var FrontendMetrics map[string]FrontendMetricsRecorder = map[string]FrontendMetricsRecorder{}

func registerFrontendHistogram(reg prometheus.Registerer, name string, help string) {
	defBuckets := []float64{.1, .25, .5, 1, 1.5, 2, 5, 10, 20, 40}

	histogram := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:      name,
		Help:      help,
		Buckets:   defBuckets,
		Namespace: ExporterName,
	})

	FrontendMetrics[name] = func(event FrontendMetricEvent) {
		histogram.Observe(event.Value)
	}

	reg.MustRegister(histogram)
}

func initFrontendMetrics(r prometheus.Registerer) {
	registerFrontendHistogram(r, "frontend_boot_load_time_seconds", "Frontend boot time measurement")
	registerFrontendHistogram(r, "frontend_boot_first_paint_time_seconds", "Frontend boot first paint")
	registerFrontendHistogram(r, "frontend_boot_first_contentful_paint_time_seconds", "Frontend boot first contentful paint")
	registerFrontendHistogram(r, "frontend_boot_js_done_time_seconds", "Frontend boot initial js load")
	registerFrontendHistogram(r, "frontend_boot_css_time_seconds", "Frontend boot initial css load")
	registerFrontendHistogram(r, "frontend_plugins_preload_ms", "Frontend preload plugin time measurement")
}

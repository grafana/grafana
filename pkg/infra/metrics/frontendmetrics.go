package metrics

import "github.com/prometheus/client_golang/prometheus"

// PostPostFrontendMetricsCommand sent by frontend to record frontend metrics
type PostFrontendMetricsCommand struct {
	Events []FrontendMetricEvent `json:"events"`
}

// FrontendMetricEvent a single metric measurement event
type FrontendMetricEvent struct {
	Name   string            `json:"name"`
	Value  float64           `json:"value"`
	Labels map[string]string `json:"labels"`
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

func registerFrontendHistogramVec(reg prometheus.Registerer, name string,labels []string, help string) {
	defBuckets := []float64{.1, .25, .5, 1, 1.5, 2, 5, 10, 20, 40}

	histogram := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:      name,
		Help:      help,
		Buckets:   defBuckets,
		Namespace: HelixExporterName,
	}, labels)

	FrontendMetrics[name] = func(event FrontendMetricEvent) {
		histogram.With(event.Labels).Observe(event.Value)
	}

	reg.MustRegister(histogram)
}
// BMC code
// Registers Counter vector frontend metric
func registerFrontendCounterVec(reg prometheus.Registerer, name string, labels []string, help string) {
	counterVec := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name:      name,
		Help:      help,
		Namespace: HelixExporterName,
	}, labels)
	FrontendMetrics[name] = func(event FrontendMetricEvent) {
		counterVec.With(event.Labels).Add(event.Value)
	}
	reg.MustRegister(counterVec)
}

func initFrontendMetrics(r prometheus.Registerer) {
	registerFrontendHistogram(r, "frontend_boot_load_time_seconds", "Frontend boot time measurement")
	registerFrontendHistogram(r, "frontend_boot_first_paint_time_seconds", "Frontend boot first paint")
	registerFrontendHistogram(r, "frontend_boot_first_contentful_paint_time_seconds", "Frontend boot first contentful paint")
	registerFrontendHistogram(r, "frontend_boot_js_done_time_seconds", "Frontend boot initial js load")
	registerFrontendHistogram(r, "frontend_boot_css_time_seconds", "Frontend boot initial css load")
	registerFrontendHistogram(r, "frontend_plugins_preload_ms", "Frontend preload plugin time measurement")
    // BMC code
	/*
		url :: http://localhost:3000/api/frontend-metrics
		json ::{
	 "events":   [
	    {
	        "name": "api_dashboard_loadtime",
	        "value": 10,
	        "labels": {
	                "dashboard_name": "test",
	                "tenant_name": "xerox"
	        }
	    }
	]
	}
	*/
	registerFrontendHistogramVec(r, "api_dashboard_loadtime", []string{"dashboard_id", "tenant_id"}, "Dashboard load time")
	registerFrontendCounterVec(r, "api_user_dashboard_hit", []string{"user_id", "tenant_id"}, "Dashboard hit by user")
	registerFrontendCounterVec(r, "api_dashboard_hit", []string{"dashboard_id", "tenant_id"}, "Dashboard hit")
    registerFrontendCounterVec(r, "api_dashboard_hit_with_user_info", []string{"dashboard_id", "user_id", "tenant_id"}, "Dashboard hit along with user details")
	registerFrontendCounterVec(r, "api_insightfinder_value_realization_prompt_count", []string{"tenant_id", "user_id", "datasource_id", "agent_id"}, "Insightfinder value realization prompt count")
	registerFrontendCounterVec(r, "api_insightfinder_value_realization_conversation_count", []string{"tenant_id", "user_id", "datasource_id", "agent_id"}, "Insightfinder value realization conversation count")
	registerFrontendCounterVec(r, "api_insightfinder_value_realization_panels_generated_count", []string{"tenant_id", "user_id", "datasource_id", "agent_id"}, "Insightfinder value realization panels generated count")
	registerFrontendHistogramVec(r, "api_insightfinder_value_realization_response_time_ms", []string{"tenant_id", "user_id", "datasource_id", "agent_id"}, "Insightfinder value realization response time")

}

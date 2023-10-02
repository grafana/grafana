package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var (
	// DefBuckets are histogram buckets for the response time (in seconds)
	// of a network service, including one that is responding very slowly.
	defBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25}
)

// RequestMetrics is a middleware handler that instruments the request.
func RequestMetrics(features featuremgmt.FeatureToggles, cfg *setting.Cfg, promRegister prometheus.Registerer) web.Middleware {
	log := log.New("middleware.request-metrics")

	httpRequestsInFlight := prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "grafana",
			Name:      "http_request_in_flight",
			Help:      "A gauge of requests currently being served by Grafana.",
		},
	)

	histogramLabels := []string{"handler", "status_code", "method"}

	if features.IsEnabled(featuremgmt.FlagRequestInstrumentationStatusSource) {
		histogramLabels = append(histogramLabels, "status_source")
	}

	if cfg.MetricsIncludeTeamLabel {
		histogramLabels = append(histogramLabels, "team")
	}

	if features.IsEnabled(featuremgmt.FlagHttpSLOLevels) {
		histogramLabels = append(histogramLabels, "slo_group")
	}

	httpRequestDurationHistogram := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "http_request_duration_seconds",
			Help:      "Histogram of latencies for HTTP requests.",
			Buckets:   defBuckets,
		},
		histogramLabels,
	)

	promRegister.MustRegister(httpRequestsInFlight, httpRequestDurationHistogram)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rw := web.Rw(w, r)
			now := time.Now()
			httpRequestsInFlight.Inc()
			defer httpRequestsInFlight.Dec()
			next.ServeHTTP(w, r)

			status := rw.Status()
			code := sanitizeCode(status)

			handler := "unknown"
			// TODO: do not depend on web.Context from the future
			if routeOperation, exists := RouteOperationName(web.FromContext(r.Context()).Req); exists {
				handler = routeOperation
			} else {
				// if grafana does not recognize the handler and returns 404 we should register it as `notfound`
				if status == http.StatusNotFound {
					handler = "notfound"
				} else {
					// log requests where we could not identify handler so we can register them.
					if features.IsEnabled(featuremgmt.FlagLogRequestsInstrumentedAsUnknown) {
						log.Warn("request instrumented as unknown", "path", r.URL.Path, "status_code", status)
					}
				}
			}

			labelValues := []string{handler, code, r.Method}
			rmd := requestmeta.GetRequestMetaData(r.Context())

			if features.IsEnabled(featuremgmt.FlagRequestInstrumentationStatusSource) {
				labelValues = append(labelValues, string(rmd.StatusSource))
			}

			if cfg.MetricsIncludeTeamLabel {
				labelValues = append(labelValues, rmd.Team)
			}

			if features.IsEnabled(featuremgmt.FlagHttpSLOLevels) {
				labelValues = append(labelValues, string(rmd.SLOGroup))
			}

			// avoiding the sanitize functions for in the new instrumentation
			// since they dont make much sense. We should remove them later.
			histogram := httpRequestDurationHistogram.
				WithLabelValues(labelValues...)

			if traceID := tracing.TraceIDFromContext(r.Context(), true); traceID != "" {
				// Need to type-convert the Observer to an
				// ExemplarObserver. This will always work for a
				// HistogramVec.
				histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(
					time.Since(now).Seconds(), prometheus.Labels{"traceID": traceID},
				)
				return
			}
			histogram.Observe(time.Since(now).Seconds())

			switch {
			case strings.HasPrefix(r.RequestURI, "/api/datasources/proxy"):
				countProxyRequests(status)
			case strings.HasPrefix(r.RequestURI, "/api/"):
				countApiRequests(status)
			default:
				countPageRequests(status)
			}
		})
	}
}

func countApiRequests(status int) {
	switch status {
	case 200:
		metrics.MApiStatus.WithLabelValues("200").Inc()
	case 404:
		metrics.MApiStatus.WithLabelValues("404").Inc()
	case 500:
		metrics.MApiStatus.WithLabelValues("500").Inc()
	default:
		metrics.MApiStatus.WithLabelValues("unknown").Inc()
	}
}

func countPageRequests(status int) {
	switch status {
	case 200:
		metrics.MPageStatus.WithLabelValues("200").Inc()
	case 404:
		metrics.MPageStatus.WithLabelValues("404").Inc()
	case 500:
		metrics.MPageStatus.WithLabelValues("500").Inc()
	default:
		metrics.MPageStatus.WithLabelValues("unknown").Inc()
	}
}

func countProxyRequests(status int) {
	switch status {
	case 200:
		metrics.MProxyStatus.WithLabelValues("200").Inc()
	case 404:
		metrics.MProxyStatus.WithLabelValues("400").Inc()
	case 500:
		metrics.MProxyStatus.WithLabelValues("500").Inc()
	default:
		metrics.MProxyStatus.WithLabelValues("unknown").Inc()
	}
}

// If the wrapped http.Handler has not set a status code, i.e. the value is
// currently 0, sanitizeCode will return 200, for consistency with behavior in
// the stdlib.
func sanitizeCode(s int) string {
	if s == 0 {
		return "200"
	}
	return strconv.Itoa(s)
}

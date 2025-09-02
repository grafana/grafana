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
	// Histogram buckets for the response time, in seconds
	durationDefBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25}

	// Histogram buckets for response sizes, in bytes
	sizeDefBuckets = prometheus.ExponentialBuckets(128, 2, 16) // 128 bytes ... 4 MB
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

	histogramLabels := []string{"handler", "status_code", "method", "status_source", "slo_group"}

	if cfg.MetricsIncludeTeamLabel {
		histogramLabels = append(histogramLabels, "grafana_team")
	}

	reqDurationOptions := prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "http_request_duration_seconds",
		Help:      "Histogram of latencies for HTTP requests.",
		Buckets:   durationDefBuckets,
	}

	reqSizeOptions := prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "http_response_size_bytes",
		Help:      "Histogram of request sizes for HTTP requests.",
		Buckets:   sizeDefBuckets, // 100B ... ~1MB
	}

	if features.IsEnabledGlobally(featuremgmt.FlagEnableNativeHTTPHistogram) {
		// the recommended default value from the prom_client
		// https://github.com/prometheus/client_golang/blob/main/prometheus/histogram.go#L411
		// Giving this variable a value means the client will expose a native
		// histogram.
		reqDurationOptions.NativeHistogramBucketFactor = 1.1
		reqSizeOptions.NativeHistogramBucketFactor = 1.1
		// The default value in OTel. It probably good enough for us as well.
		reqDurationOptions.NativeHistogramMaxBucketNumber = 160
		reqSizeOptions.NativeHistogramMaxBucketNumber = 160
		reqDurationOptions.NativeHistogramMinResetDuration = time.Hour
		reqSizeOptions.NativeHistogramMinResetDuration = time.Hour

		if features.IsEnabledGlobally(featuremgmt.FlagDisableClassicHTTPHistogram) {
			// setting Buckets to nil with native options set means the classic
			// histogram will no longer be exposed - this can be a good way to
			// reduce cardinality in the exposed metrics
			reqDurationOptions.Buckets = nil
			reqSizeOptions.Buckets = nil
		}
	}

	httpRequestDurationHistogram := prometheus.NewHistogramVec(
		reqDurationOptions,
		histogramLabels,
	)

	httpRequestSizeHistogram := prometheus.NewHistogramVec(
		reqSizeOptions,
		histogramLabels,
	)

	promRegister.MustRegister(httpRequestsInFlight, httpRequestDurationHistogram, httpRequestSizeHistogram)

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
					if features.IsEnabled(r.Context(), featuremgmt.FlagLogRequestsInstrumentedAsUnknown) {
						log.Warn("request instrumented as unknown", "path", r.URL.Path, "status_code", status)
					}
				}
			}

			labelValues := []string{handler, code, r.Method}
			rmd := requestmeta.GetRequestMetaData(r.Context())

			labelValues = append(labelValues, string(rmd.StatusSource), string(rmd.SLOGroup))

			if cfg.MetricsIncludeTeamLabel {
				labelValues = append(labelValues, rmd.Team)
			}

			// avoiding the sanitize functions for in the new instrumentation
			// since they dont make much sense. We should remove them later.
			durationHistogram := httpRequestDurationHistogram.
				WithLabelValues(labelValues...)
			sizeHistogram := httpRequestSizeHistogram.
				WithLabelValues(labelValues...)

			elapsedTime := time.Since(now).Seconds()

			if traceID := tracing.TraceIDFromContext(r.Context(), true); traceID != "" {
				// Need to type-convert the Observer to an
				// ExemplarObserver. This will always work for a
				// HistogramVec.
				durationHistogram.(prometheus.ExemplarObserver).ObserveWithExemplar(
					elapsedTime, prometheus.Labels{"traceID": traceID},
				)
			} else {
				durationHistogram.Observe(elapsedTime)
			}

			sizeHistogram.Observe(float64(rw.Size()))

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

package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	cw "github.com/weaveworks/common/middleware"
	"gopkg.in/macaron.v1"
)

var (
	httpRequestsInFlight         prometheus.Gauge
	httpRequestDurationHistogram *prometheus.HistogramVec

	// DefBuckets are histogram buckets for the response time (in seconds)
	// of a network service, including one that is responding very slowly.
	defBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5}
)

func init() {
	httpRequestsInFlight = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "grafana",
			Name:      "http_request_in_flight",
			Help:      "A gauge of requests currently being served by Grafana.",
		},
	)

	httpRequestDurationHistogram = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "http_request_duration_seconds",
			Help:      "Histogram of latencies for HTTP requests.",
			Buckets:   defBuckets,
		},
		[]string{"handler", "status_code", "method"},
	)

	prometheus.MustRegister(httpRequestsInFlight, httpRequestDurationHistogram)
}

// RequestMetrics is a middleware handler that instruments the request
func RequestMetrics(cfg *setting.Cfg) func(handler string) macaron.Handler {
	return func(handler string) macaron.Handler {
		return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
			rw := res.(macaron.ResponseWriter)
			now := time.Now()
			httpRequestsInFlight.Inc()
			defer httpRequestsInFlight.Dec()
			c.Next()

			status := rw.Status()

			code := sanitizeCode(status)
			method := sanitizeMethod(req.Method)

			// enable histogram and disable summaries + counters for http requests.
			if cfg.IsHTTPRequestHistogramDisabled() {
				duration := time.Since(now).Nanoseconds() / int64(time.Millisecond)
				metrics.MHttpRequestTotal.WithLabelValues(handler, code, method).Inc()
				metrics.MHttpRequestSummary.WithLabelValues(handler, code, method).Observe(float64(duration))
			} else {
				// avoiding the sanitize functions for in the new instrumentation
				// since they dont make much sense. We should remove them later.
				histogram := httpRequestDurationHistogram.
					WithLabelValues(handler, strconv.Itoa(rw.Status()), req.Method)
				if traceID, ok := cw.ExtractSampledTraceID(c.Req.Context()); ok {
					// Need to type-convert the Observer to an
					// ExemplarObserver. This will always work for a
					// HistogramVec.
					histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(
						time.Since(now).Seconds(), prometheus.Labels{"traceID": traceID},
					)
					return
				}
				histogram.Observe(time.Since(now).Seconds())
			}

			switch {
			case strings.HasPrefix(req.RequestURI, "/api/datasources/proxy"):
				countProxyRequests(status)
			case strings.HasPrefix(req.RequestURI, "/api/"):
				countApiRequests(status)
			default:
				countPageRequests(status)
			}
		}
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

func sanitizeMethod(m string) string {
	return strings.ToLower(m)
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

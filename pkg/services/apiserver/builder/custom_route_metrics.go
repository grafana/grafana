package builder

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/endpoints/metrics"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// CustomRouteMetrics provides metrics for custom API routes that bypass the standard
// Kubernetes REST storage path. It reuses the standard apiserver_request_total metric
// to ensure consistency with other apiserver metrics.
type CustomRouteMetrics struct {
	// We don't store anything here since we use the global k8s metrics
}

// NewCustomRouteMetrics creates a new CustomRouteMetrics.
// Note: This doesn't register any new metrics, it reuses the existing
// `apiserver_request_total` metric that's already registered by Kubernetes.
func NewCustomRouteMetrics(_ prometheus.Registerer) *CustomRouteMetrics {
	// No need to register anything - we'll use the existing k8s metrics
	return &CustomRouteMetrics{}
}

type responseWriterWithStatus struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func newResponseWriterWithStatus(w http.ResponseWriter) *responseWriterWithStatus {
	return &responseWriterWithStatus{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		written:        false,
	}
}

func (w *responseWriterWithStatus) WriteHeader(statusCode int) {
	if !w.written {
		w.statusCode = statusCode
		w.written = true
	}
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *responseWriterWithStatus) Write(b []byte) (int, error) {
	if !w.written {
		// If WriteHeader hasn't been called,
		// this is a StatusOK (default)
		w.written = true
	}
	return w.ResponseWriter.Write(b)
}

func (w *responseWriterWithStatus) StatusCode() int {
	return w.statusCode
}

// InstrumentHandler wraps an HTTP handler to record metrics for custom routes.
// It captures the status code and records it using the standard apiserver_request_total metric,
// making custom routes appear alongside regular Kubernetes API metrics.
func (m *CustomRouteMetrics) InstrumentHandler(group, version, resource string, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		wrappedWriter := newResponseWriterWithStatus(w)
		startTime := time.Now()

		handler(wrappedWriter, r)

		// Determine scope
		// See:
		// https://github.com/kubernetes/kubernetes/blob/3828756d90cf28e0ab5e0ccd550041b70c642b91/staging/src/k8s.io/apiextensions-apiserver/pkg/apiserver/customresource_handler.go#L326
		scope := "cluster"
		if reqInfo, ok := request.RequestInfoFrom(r.Context()); ok && reqInfo != nil {
			scope = metrics.CleanScope(reqInfo)
		}

		// Record using the standard Kubernetes apiserver_request_total metric
		// This makes custom routes appear in the same metric as standard REST API calls
		// See:
		// https://github.com/kubernetes/kubernetes/blob/3828756d90cf28e0ab5e0ccd550041b70c642b91/staging/src/k8s.io/apiserver/pkg/endpoints/metrics/metrics.go#L78-L86
		metrics.MonitorRequest(
			r,
			r.Method,                   // verb (HTTP method)
			group,                      // API group
			version,                    // API version
			resource,                   // resource name (e.g., "stats", "settings")
			"",                         // subresource (empty for custom routes)
			scope,                      // scope (cluster, namespace, or resource)
			"",                         // not sure if component is neeeded for custom resources
			false,                      // if endpoint is deprecated, default to false
			"",                         // `removedRelease` is unused with `deprecated=false`
			wrappedWriter.StatusCode(), // HTTP status code
			0,                          // respSize (not tracked)
			time.Since(startTime),
		)
	}
}

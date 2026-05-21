package client

import (
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

var (
	clientRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "apiserver_client",
			Name:      "requests_total",
			Help:      "Total requests made by backend callers through K8sHandler, by caller subsystem, verb, resource, and outcome.",
		},
		[]string{"caller", "verb", "group", "resource", "status_class"},
	)

	clientRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "apiserver_client",
			Name:      "request_duration_seconds",
			Help:      "Duration of backend K8sHandler requests by caller, verb, and resource.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"caller", "verb", "group", "resource"},
	)

	registerMetricsOnce sync.Once
)

// RegisterMetrics registers the apiserver-client metric vectors with the
// supplied registerer. Safe to call from multiple wiring sites — registration
// runs once per process.
func RegisterMetrics(reg prometheus.Registerer) {
	registerMetricsOnce.Do(func() {
		reg.MustRegister(clientRequests, clientRequestDuration)
	})
}

// RecordRequest emits one counter increment and one duration observation for
// a K8sHandler call. Callers pass their own subsystem name (e.g.
// "folder_service") so usage stays attributable when multiple packages share
// the same backing client.
func RecordRequest(caller, verb, group, resource string, start time.Time, err error) {
	clientRequests.WithLabelValues(caller, verb, group, resource, classifyStatus(err)).Inc()
	clientRequestDuration.WithLabelValues(caller, verb, group, resource).Observe(time.Since(start).Seconds())
}

// classifyStatus buckets an error into a low-cardinality label value.
// Match the k8s status families so it lines up with apiserver_request_total{code}.
func classifyStatus(err error) string {
	if err == nil {
		return "2xx"
	}
	var se *apierrors.StatusError
	if errors.As(err, &se) {
		code := se.Status().Code
		switch {
		case code >= 200 && code < 300:
			return "2xx"
		case code >= 400 && code < 500:
			return "4xx"
		case code >= 500 && code < 600:
			return "5xx"
		}
	}
	return "error"
}

package client

import (
	"errors"
	"sync"

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

// RegisterMetrics registers K8sHandler client metrics with the supplied
// registerer. Safe to call from multiple wiring sites — the underlying
// registration runs once per process.
func RegisterMetrics(reg prometheus.Registerer) {
	registerMetricsOnce.Do(func() {
		reg.MustRegister(clientRequests, clientRequestDuration)
	})
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

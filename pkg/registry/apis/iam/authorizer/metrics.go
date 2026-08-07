package authorizer

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	metricsNamespace = "iam"
	metricsSubsystem = "apiserver"
)

var (
	registerMetricsOnce sync.Once

	// parentFetchDuration tracks the latency of parent (folder) lookups performed during
	// resource permission authorization. These run per-item when filtering lists, so this is
	// the key signal for the N+1 cost of folder resolution.
	// Labels: resource (group.resource of the target), status (Kubernetes status reason,
	// e.g. Success/NotFound/Forbidden, matching the storage wrapper's status vocabulary).
	parentFetchDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubsystem,
		Name:      "resource_permissions_parent_fetch_duration_seconds",
		Help:      "Latency of parent (folder) lookups performed during resource permission authorization, by resource and status",
		Buckets:   prometheus.DefBuckets, // 5ms to 10s
	}, []string{"resource", "status"})
)

// RegisterMetrics registers the IAM authorizer metrics with the given registerer.
func RegisterMetrics(reg prometheus.Registerer) {
	registerMetricsOnce.Do(func() {
		if err := reg.Register(parentFetchDuration); err != nil {
			log.New("iam.authorizer").Warn("failed to register iam authorizer metrics", "error", err)
		}
	})
}

func observeParentFetch(gr schema.GroupResource, dur time.Duration, err error) {
	parentFetchDuration.WithLabelValues(gr.String(), statusFromError(err)).Observe(dur.Seconds())
}

// statusFromError maps an error to a metric status label using Kubernetes status
// reasons (e.g. Success, NotFound, Forbidden). Intentionally mirrors the storage
// wrapper's classifier so both IAM histograms share one status vocabulary.
func statusFromError(err error) string {
	if err == nil {
		return metav1.StatusSuccess
	}
	if reason := apierrors.ReasonForError(err); reason != metav1.StatusReasonUnknown {
		return string(reason)
	}
	return metav1.StatusFailure
}

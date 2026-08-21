package resources

import (
	"errors"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

// Operation labels for the request-duration metric. They name the resource
// client verb, so a slow or failing verb can be told apart from the others.
const (
	operationCreate           = "create"
	operationUpdate           = "update"
	operationUpdateStatus     = "update_status"
	operationDelete           = "delete"
	operationDeleteCollection = "delete_collection"
	operationGet              = "get"
	operationList             = "list"
	operationPatch            = "patch"
	operationApply            = "apply"
	operationApplyStatus      = "apply_status"
)

// clientMetrics measures the Kubernetes API server requests provisioning issues
// against the resources it manages (dashboards, folders, and any other
// configured kinds). Latency is labelled by resource, operation and outcome so
// slow or failing verbs can be told apart per resource type. Durations cover the
// whole retried operation, including backoff waits, since that is the latency
// the caller actually sees.
type clientMetrics struct {
	requestDuration *prometheus.HistogramVec
}

// newClientMetrics builds the client metrics on reg, reusing collectors already
// registered there so factories sharing a registry share one collector. A nil
// reg leaves the collectors unregistered but usable.
func newClientMetrics(reg prometheus.Registerer) *clientMetrics {
	return &clientMetrics{
		requestDuration: registerOrReuse(reg, prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_provisioning_apiserver_request_duration_seconds",
			Help:                            "Duration of the Kubernetes API server requests provisioning issues for the resources it manages, by resource group, resource, operation and outcome. Includes retry/backoff time.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"group", "resource", "operation", "outcome"})),
	}
}

// observe records one API server request. It is safe to call on a nil
// *clientMetrics: a client factory built without a registry produces one.
func (m *clientMetrics) observe(gvr schema.GroupVersionResource, operation string, start time.Time, err error) {
	if m == nil {
		return
	}
	outcome := utils.SuccessOutcome
	if err != nil {
		outcome = utils.ErrorOutcome
	}
	m.requestDuration.WithLabelValues(gvr.Group, gvr.Resource, operation, outcome).Observe(time.Since(start).Seconds())
}

// registerOrReuse registers c on reg, returning the collector already registered
// under the same descriptor when there is one. A nil reg returns c unregistered.
func registerOrReuse[C prometheus.Collector](reg prometheus.Registerer, c C) C {
	if reg == nil {
		return c
	}
	if err := reg.Register(c); err != nil {
		are := prometheus.AlreadyRegisteredError{}
		if errors.As(err, &are) {
			return are.ExistingCollector.(C)
		}
		panic(err)
	}
	return c
}

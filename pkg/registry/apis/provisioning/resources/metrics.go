package resources

import (
	"errors"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ComponentID identifies the Grafana subsystem that owns a client factory. It
// becomes the "component" label on the request-duration metric, so subsystems
// sharing one registry — and therefore one collector — stay distinguishable.
// Adding a construction site means picking a value here rather than inventing a
// string, so the label's value set stays enumerable.
type ComponentID string

const (
	ComponentProvisioning         ComponentID = "provisioning"
	ComponentProvisioningWebhooks ComponentID = "provisioning_webhooks"
	ComponentZanzana              ComponentID = "zanzana"
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

// Outcome labels for the request-duration metric. These deliberately match the
// values in provisioning's utils package so queries can join this metric with
// grafana_provisioning_* ones; they are redeclared here rather than imported so
// this package carries no provisioning-specific dependency — it is shared with
// zanzana. Nothing but this comment keeps the two in sync.
const (
	outcomeSuccess = "success"
	outcomeError   = "error"
)

// clientMetrics measures the outbound Kubernetes API server requests a Grafana
// subsystem makes through this package's dynamic client factory. The factory is
// shared — provisioning, its webhooks and zanzana all use it, and in a
// single-binary Grafana they are handed the same registry — so every observation
// carries a "component" label naming the caller. Latency is further labelled by
// resource group, resource, operation and outcome, so a slow or failing verb can
// be told apart per resource type per caller. Durations cover the whole retried
// operation, including backoff waits, since that is the latency the caller
// actually sees.
//
// The metric is grafana_apiserver_client_request_duration_seconds. The "client"
// infix is load-bearing, not stylistic: k8s.io/apiserver registers the
// server-side apiserver_request_duration_seconds on the same legacy registry,
// and pkg/infra/metrics renames un-prefixed families to grafana_* when
// gathering, so grafana_apiserver_request_duration_seconds already exists in
// Grafana's /metrics output. Reusing that name would not collide at
// registration — the fqName on our registry differs — but would emit two metric
// families under one name in the scrape body, which fails the parse for the
// whole endpoint. Keep the infix.
type clientMetrics struct {
	// component identifies the owning subsystem. It labels every observation, so
	// callers sharing one collector remain distinguishable.
	component       ComponentID
	requestDuration *prometheus.HistogramVec
}

// newClientMetrics builds the client metrics on reg for the given component,
// reusing collectors already registered there so factories sharing a registry
// share one collector. A nil reg leaves the collectors unregistered but usable.
func newClientMetrics(reg prometheus.Registerer, component ComponentID) *clientMetrics {
	return &clientMetrics{
		component: component,
		requestDuration: registerOrReuse(reg, prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_apiserver_client_request_duration_seconds",
			Help:                            "Duration of the outbound Kubernetes API server requests a Grafana subsystem makes for the resources it manages, by calling component, resource group, resource, operation and outcome. Includes retry/backoff time. This is the client-side counterpart to the server-side grafana_apiserver_request_duration_seconds.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"component", "group", "resource", "operation", "outcome"})),
	}
}

// observe records one API server request. It is safe to call on a nil
// *clientMetrics: a client factory built without a registry produces one.
func (m *clientMetrics) observe(gvr schema.GroupVersionResource, operation string, start time.Time, err error) {
	if m == nil {
		return
	}
	outcome := outcomeSuccess
	if err != nil {
		outcome = outcomeError
	}
	// WithLabelValues is positional: the order here must match the label names
	// declared in newClientMetrics.
	m.requestDuration.WithLabelValues(string(m.component), gvr.Group, gvr.Resource, operation, outcome).Observe(time.Since(start).Seconds())
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
			// A wrapping registerer (prometheus.WrapRegistererWith) hands back a
			// wrapped collector rather than one of type C, so the assertion is
			// checked: fall back to the unregistered collector instead of panicking
			// in a path that runs on every API server call.
			if existing, ok := are.ExistingCollector.(C); ok {
				return existing
			}
			return c
		}
		panic(err)
	}
	return c
}

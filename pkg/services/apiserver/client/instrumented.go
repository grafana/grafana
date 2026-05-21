package client

import (
	"context"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// CallerUnknown is the default caller label when an instrumented handler is
// constructed without an explicit caller. Alerts should treat a non-zero rate
// on `caller="unknown"` as a missing wiring annotation.
const CallerUnknown = "unknown"

// NewK8sHandlerWithMetrics wraps a K8sHandler so every apiserver-facing call
// emits the metrics declared in metrics.go. The caller string identifies the
// owning subsystem (e.g. "folder_service", "dashboards", "provisioning").
//
// Call RegisterMetrics once with a prometheus.Registerer to expose the
// metrics; this constructor does not register anything itself so it can be
// called from arbitrary wiring sites.
func NewK8sHandlerWithMetrics(inner K8sHandler, caller string) K8sHandler {
	if caller == "" {
		caller = CallerUnknown
	}
	return &instrumentedK8sHandler{inner: inner, caller: caller}
}

type instrumentedK8sHandler struct {
	inner  K8sHandler
	caller string
}

func (h *instrumentedK8sHandler) gvr() (group, resource string) {
	if k, ok := h.inner.(*k8sHandler); ok {
		return k.gvr.Group, k.gvr.Resource
	}
	return "unknown", "unknown"
}

func (h *instrumentedK8sHandler) observe(verb string, start time.Time, err error) {
	group, resource := h.gvr()
	clientRequests.WithLabelValues(h.caller, verb, group, resource, classifyStatus(err)).Inc()
	clientRequestDuration.WithLabelValues(h.caller, verb, group, resource).Observe(time.Since(start).Seconds())
}

func (h *instrumentedK8sHandler) GetNamespace(orgID int64) string {
	return h.inner.GetNamespace(orgID)
}

func (h *instrumentedK8sHandler) Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	start := time.Now()
	out, err := h.inner.Get(ctx, name, orgID, options, subresource...)
	h.observe("get", start, err)
	return out, err
}

func (h *instrumentedK8sHandler) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.CreateOptions) (*unstructured.Unstructured, error) {
	start := time.Now()
	out, err := h.inner.Create(ctx, obj, orgID, opts)
	h.observe("create", start, err)
	return out, err
}

func (h *instrumentedK8sHandler) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.UpdateOptions) (*unstructured.Unstructured, error) {
	start := time.Now()
	out, err := h.inner.Update(ctx, obj, orgID, opts)
	h.observe("update", start, err)
	return out, err
}

func (h *instrumentedK8sHandler) Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error {
	start := time.Now()
	err := h.inner.Delete(ctx, name, orgID, options)
	h.observe("delete", start, err)
	return err
}

func (h *instrumentedK8sHandler) DeleteCollection(ctx context.Context, orgID int64, listOptions v1.ListOptions) error {
	start := time.Now()
	err := h.inner.DeleteCollection(ctx, orgID, listOptions)
	h.observe("deletecollection", start, err)
	return err
}

func (h *instrumentedK8sHandler) List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error) {
	start := time.Now()
	out, err := h.inner.List(ctx, orgID, options)
	h.observe("list", start, err)
	return out, err
}

func (h *instrumentedK8sHandler) Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	start := time.Now()
	out, err := h.inner.Search(ctx, orgID, in)
	h.observe("search", start, err)
	return out, err
}

func (h *instrumentedK8sHandler) GetStats(ctx context.Context, orgID int64) (*resourcepb.ResourceStatsResponse, error) {
	start := time.Now()
	out, err := h.inner.GetStats(ctx, orgID)
	h.observe("stats", start, err)
	return out, err
}

func (h *instrumentedK8sHandler) GetUsersFromMeta(ctx context.Context, userMeta []string) (map[string]*user.User, error) {
	return h.inner.GetUsersFromMeta(ctx, userMeta)
}

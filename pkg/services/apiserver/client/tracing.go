package client

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type k8sClientTracingWrapper struct {
	wrapped K8sHandler
	gvr     schema.GroupVersionResource
}

var _ K8sHandler = (*k8sClientTracingWrapper)(nil)

func NewK8sClientTracingWrapper(wrapped K8sHandler, gvr schema.GroupVersionResource) K8sHandler {
	return &k8sClientTracingWrapper{
		wrapped: wrapped,
		gvr:     gvr,
	}
}

func (h *k8sClientTracingWrapper) GetNamespace(orgID int64) string {
	return h.wrapped.GetNamespace(orgID)
}

func (h *k8sClientTracingWrapper) getGVRAttributes(orgID int64) []attribute.KeyValue {
	return []attribute.KeyValue{
		semconv.K8SNamespaceName(h.wrapped.GetNamespace(orgID)),
		attribute.String("k8s.group", h.gvr.Group),
		attribute.String("k8s.version", h.gvr.Version),
		attribute.String("k8s.resource", h.gvr.Resource),
	}
}

func (h *k8sClientTracingWrapper) Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.Get", h.getGVRAttributes(orgID)...)
	defer span.End()

	result, err := h.wrapped.Get(ctx, name, orgID, options, subresource...)
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	return result, nil
}

func (h *k8sClientTracingWrapper) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.Create", h.getGVRAttributes(orgID)...)
	defer span.End()

	result, err := h.wrapped.Create(ctx, obj, orgID)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return result, nil
}

func (h *k8sClientTracingWrapper) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.Update", h.getGVRAttributes(orgID)...)
	defer span.End()

	result, err := h.wrapped.Update(ctx, obj, orgID)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return result, nil
}

func (h *k8sClientTracingWrapper) Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error {
	ctx, span := tracing.Start(ctx, "K8sClient.Delete", h.getGVRAttributes(orgID)...)
	defer span.End()

	err := h.wrapped.Delete(ctx, name, orgID, options)
	if err != nil {
		return tracing.Error(span, err)
	}
	return nil
}

func (h *k8sClientTracingWrapper) DeleteCollection(ctx context.Context, orgID int64) error {
	ctx, span := tracing.Start(ctx, "K8sClient.DeleteCollection", h.getGVRAttributes(orgID)...)
	defer span.End()

	err := h.wrapped.DeleteCollection(ctx, orgID)
	if err != nil {
		return tracing.Error(span, err)
	}
	return nil
}

func (h *k8sClientTracingWrapper) List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.List", h.getGVRAttributes(orgID)...)
	defer span.End()

	result, err := h.wrapped.List(ctx, orgID, options)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return result, nil
}

func (h *k8sClientTracingWrapper) Search(ctx context.Context, orgID int64, in *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.Search", h.getGVRAttributes(orgID)...)
	defer span.End()

	resp, err := h.wrapped.Search(ctx, orgID, in)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return resp, nil
}

func (h *k8sClientTracingWrapper) GetStats(ctx context.Context, orgID int64) (*resource.ResourceStatsResponse, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.GetStats", h.getGVRAttributes(orgID)...)
	defer span.End()

	resp, err := h.wrapped.GetStats(ctx, orgID)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return resp, nil
}

func (h *k8sClientTracingWrapper) GetUsersFromMeta(ctx context.Context, userMeta []string) (map[string]*user.User, error) {
	ctx, span := tracing.Start(ctx, "K8sClient.GetUsersFromMeta")
	defer span.End()

	users, err := h.wrapped.GetUsersFromMeta(ctx, userMeta)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return users, nil
}

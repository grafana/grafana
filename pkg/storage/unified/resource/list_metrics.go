package resource

import (
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	listPathUnknown                      = "unknown"
	listPathFieldSelector                = "field_selector"
	listPathSearch                       = "search"
	listPathStoreAuthorizeFirst          = "store_authorize_first"
	listPathStoreFetchFirst              = "store_fetch_first"
	listPathSearchFallbackAuthorizeFirst = "search_fallback_authorize_first"
	listPathSearchFallbackFetchFirst     = "search_fallback_fetch_first"
	listPathHistory                      = "history"
	listPathTrash                        = "trash"
)

func annotateListRequest(span trace.Span, path, selectorType string, requestedLimit int64, req *resourcepb.ListRequest, rsp *resourcepb.ListResponse) {
	responseItems := 0
	hasMore := false
	if rsp != nil {
		responseItems = len(rsp.GetItems())
		hasMore = rsp.GetNextPageToken() != ""
	}
	attrs := []attribute.KeyValue{
		attribute.String("list.path", path),
		attribute.Int("list.response_items", responseItems),
		attribute.Bool("list.has_more", hasMore),
	}
	if req != nil {
		scope := "cluster"
		if opts := req.GetOptions(); opts != nil {
			if key := opts.GetKey(); key != nil && key.GetNamespace() != "" {
				scope = "namespace"
			}
		}
		attrs = append(attrs,
			attribute.String("list.source", req.GetSource().String()),
			attribute.String("list.scope", scope),
			attribute.String("list.selectors", selectorType),
			attribute.Bool("list.keys_only", req.GetKeysOnly()),
			attribute.Int64("list.limit", requestedLimit),
			attribute.Bool("list.continue", req.GetNextPageToken() != ""),
		)
	}
	span.SetAttributes(attrs...)
}

func listSelectorType(req *resourcepb.ListRequest) string {
	if req == nil {
		return "none"
	}
	opts := req.GetOptions()
	if opts == nil {
		return "none"
	}
	hasFields := len(opts.GetFields()) > 0
	hasLabels := len(opts.GetLabels()) > 0
	switch {
	case hasFields && hasLabels:
		return "field_and_label"
	case hasFields:
		return "field"
	case hasLabels:
		return "label"
	default:
		return "none"
	}
}

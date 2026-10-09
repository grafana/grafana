package resource

import (
	"context"

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
	listPathTrashSearch                  = "trash_search"
	listPathTrashSearchFallback          = "trash_search_fallback"

	// listSelectorNone is the selector type of a list that filters on nothing.
	listSelectorNone = "none"
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

const (
	listStopExhausted  = "exhausted"
	listStopByteLimit  = "byte_limit"
	listStopCountLimit = "count_limit"
	listStopError      = "error"
)

type listBodyStatsKey struct{}

// These count logical KV requests and yielded values, not database rows or
// driver read-ahead. The KV implementation may omit missing keys or retry reads.
type listBodyStats struct {
	supported         bool
	bodyKeysRequested int
	bodiesConsumed    int
	stopReason        string
}

func withListBodyStats(ctx context.Context) (context.Context, *listBodyStats) {
	stats := &listBodyStats{stopReason: listStopExhausted}
	return context.WithValue(ctx, listBodyStatsKey{}, stats), stats
}

func listBodyStatsFromContext(ctx context.Context) *listBodyStats {
	stats, _ := ctx.Value(listBodyStatsKey{}).(*listBodyStats)
	return stats
}

func setListStopReason(ctx context.Context, reason string) {
	if stats := listBodyStatsFromContext(ctx); stats != nil {
		stats.stopReason = reason
	}
}

func (s *server) recordListBodyStats(span trace.Span, stats *listBodyStats, path string, rsp *resourcepb.ListResponse, err error) {
	if !stats.supported {
		return
	}
	switch path {
	case listPathStoreAuthorizeFirst, listPathStoreFetchFirst, listPathSearchFallbackAuthorizeFirst, listPathSearchFallbackFetchFirst:
	default:
		return
	}

	returned := 0
	if err != nil || rsp == nil || rsp.GetError() != nil {
		stats.stopReason = listStopError
	} else {
		returned = len(rsp.Items)
	}
	span.SetAttributes(
		attribute.Int("list.body_keys_requested", stats.bodyKeysRequested),
		attribute.Int("list.bodies_consumed", stats.bodiesConsumed),
		attribute.String("list.stop_reason", stats.stopReason),
	)
	if s.storageMetrics == nil {
		return
	}
	labels := []string{path, stats.stopReason}
	s.storageMetrics.ListBodyKeysRequested.WithLabelValues(labels...).Add(float64(stats.bodyKeysRequested))
	s.storageMetrics.ListBodiesConsumed.WithLabelValues(labels...).Add(float64(stats.bodiesConsumed))
	s.storageMetrics.ListItemsReturned.WithLabelValues(labels...).Add(float64(returned))
	if stats.stopReason != listStopError {
		s.storageMetrics.ListUnusedBodyRequests.WithLabelValues(labels...).Observe(float64(max(0, stats.bodyKeysRequested-returned)))
	}
}

func listSelectorType(req *resourcepb.ListRequest) string {
	if req == nil {
		return listSelectorNone
	}
	opts := req.GetOptions()
	if opts == nil {
		return listSelectorNone
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
		return listSelectorNone
	}
}

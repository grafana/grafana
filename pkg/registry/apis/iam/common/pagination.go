package common

import (
	"context"
	"net/url"
	"strconv"

	"github.com/grafana/authlib/types"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

type Pagination struct {
	Limit    int64
	Continue int64
}

func PaginationFromListOptions(options *internalversion.ListOptions) Pagination {
	limit := options.Limit
	if limit < 1 {
		limit = DefaultListLimit
	}

	if limit > MaxListLimit {
		limit = MaxListLimit
	}

	return Pagination{
		Limit:    limit,
		Continue: parseIntWithFallback(options.Continue, 0, 0),
	}
}

func PaginationFromListQuery(query url.Values) Pagination {
	return Pagination{
		Limit:    parseIntWithFallback(query.Get("limit"), 1, DefaultListLimit),
		Continue: parseIntWithFallback(query.Get("continue"), 0, 0),
	}
}

// WithSubresourceNamespace propagates the requesting user's namespace into
// the context. Subresource Connect handlers receive a ctx without
// `request.WithNamespace` set, so downstream stores that look up
// NamespaceInfoFrom would fail; pulling it from AuthInfo restores parity
// with normal request flow.
func WithSubresourceNamespace(ctx context.Context) context.Context {
	if authInfo, ok := types.AuthInfoFrom(ctx); ok {
		return apirequest.WithNamespace(ctx, authInfo.GetNamespace())
	}
	return ctx
}

func parseIntWithFallback(original string, min int64, fallback int64) int64 {
	if original == "" {
		return fallback
	}
	v, err := strconv.ParseInt(original, 10, 64)
	if err != nil {
		return fallback
	}

	if v < min {
		return fallback
	}

	return v
}

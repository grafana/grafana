package common

import (
	"context"
	"errors"
	"fmt"
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

// SubresourcePagination is the limit/offset/page tuple that the iam
// subresource HTTP handlers (e.g. /teams/{name}/members, /users/{name}/teams)
// accept on their query string. Different handlers used to inline the same
// parsing block; PaginationFromQuery centralizes it.
type SubresourcePagination struct {
	Limit  int
	Offset int
	Page   int
}

// ErrLimitTooLarge signals the requested page size exceeds MaxListLimit.
var ErrLimitTooLarge = errors.New("limit parameter exceeds maximum")

// PaginationFromQuery parses limit / offset / page from a parsed query
// string and applies the same defaults as the IAM subresources used to
// inline:
//   - limit defaults to DefaultListLimit, capped at MaxListLimit
//   - if offset is set, page is derived from it
//   - if page is set, offset is derived from it
//
// Returns ErrLimitTooLarge if limit > MaxListLimit (callers usually map this
// to a 400 Bad Request).
func PaginationFromQuery(q url.Values) (SubresourcePagination, error) {
	p := SubresourcePagination{Limit: DefaultListLimit, Page: 1}

	if q.Has("limit") {
		p.Limit, _ = strconv.Atoi(q.Get("limit"))
	}
	if p.Limit > MaxListLimit {
		return p, fmt.Errorf("%w of %d", ErrLimitTooLarge, MaxListLimit)
	}
	if p.Limit < 1 {
		p.Limit = DefaultListLimit
	}

	switch {
	case q.Has("offset"):
		p.Offset, _ = strconv.Atoi(q.Get("offset"))
		if p.Offset > 0 {
			p.Page = (p.Offset / p.Limit) + 1
		}
	case q.Has("page"):
		p.Page, _ = strconv.Atoi(q.Get("page"))
		if p.Page < 1 {
			p.Page = 1
		}
		p.Offset = (p.Page - 1) * p.Limit
	}
	return p, nil
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

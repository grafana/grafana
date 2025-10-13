package common

import (
	"net/url"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

type Pagination struct {
	Limit    int64
	Continue int64
}

func PaginationFromListOptions(options *internalversion.ListOptions) Pagination {
	limit := options.Limit
	if limit < 1 {
		limit = 50
	}

	return Pagination{
		Limit:    limit,
		Continue: parseIntWithFallback(options.Continue, 0, 0),
	}
}

func PaginationFromListQuery(query url.Values) Pagination {
	return Pagination{
		Limit:    parseIntWithFallback(query.Get("limit"), 1, 50),
		Continue: parseIntWithFallback(query.Get("continue"), 0, 0),
	}
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

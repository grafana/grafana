package common

import (
	"fmt"
	"net/url"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

type Pagination struct {
	Limit    int64
	Continue int64
}

func PaginationFromListOptions(options *internalversion.ListOptions) (Pagination, error) {
	p := Pagination{Limit: options.Limit}
	if options.Continue != "" {
		c, err := strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return p, fmt.Errorf("invalid continue token: %w", err)
		}
		p.Continue = c
	}
	return p, nil
}

func PaginationFromListQuery(query url.Values) Pagination {
	withFallback := func(original string, fallback int64) int64 {
		if original == "" {
			return fallback
		}
		v, err := strconv.ParseInt(original, 10, 64)
		if err != nil {
			return fallback
		}
		return v

	}

	return Pagination{
		Limit:    withFallback(query.Get("limit"), 50),
		Continue: withFallback(query.Get("continue"), 0),
	}
}

// GetContinueID is a helper to parse options.Continue as int64.
// If no continue token is provided 0 is returned.
func GetContinueID(options *internalversion.ListOptions) (int64, error) {
	if options.Continue != "" {
		continueID, err := strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid continue token: %w", err)
		}
		return continueID, nil
	}
	return 0, nil
}

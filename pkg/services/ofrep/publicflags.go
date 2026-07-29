package ofrep

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
)

// isPublic reports whether flag metadata marks it public via the "public" key.
// Accepts bool true or string "true" (case-insensitive).
func isPublic(metadata map[string]any) bool {
	v, ok := metadata["public"]
	if !ok {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	case string:
		b, _ := strconv.ParseBool(val)
		return b
	default:
		return false
	}
}

// bulkFlagEvalFilteringEnabled reads the features.bulkFlagEvalFiltering flag.
// It gates only authed bulk filtering while unauth is always filtered to public flags.
func bulkFlagEvalFilteringEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagFeaturesBulkFlagEvalFiltering,
		false,
		openfeature.TransactionContext(ctx),
	)
}

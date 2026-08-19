package ofrep

import (
	"context"
	"strconv"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
func bulkFlagEvalFilteringEnabled(ctx context.Context, logger log.Logger) bool {
	evalCtx := openfeature.TransactionContext(ctx)

	details, err := openfeature.NewDefaultClient().BooleanValueDetails(
		ctx,
		featuremgmt.FlagFeaturesBulkFlagEvalFiltering,
		false,
		evalCtx,
	)

	if err != nil {
		logger.Warn("Failed to evaluate bulkFlagEvalFiltering, falling back to default",
			"default", details.Value,
			"errorCode", details.ErrorCode,
			"errorMessage", details.ErrorMessage,
			"targetingKey", evalCtx.TargetingKey(),
			"attributes", evalCtx.Attributes(),
			"err", err,
		)
		return details.Value
	}

	logger.Debug("Successfully evaluated bulkFlagEvalFiltering",
		"value", details.Value,
		"variant", details.Variant,
		"reason", details.Reason,
		"targetingKey", evalCtx.TargetingKey(),
		"attributes", evalCtx.Attributes(),
	)

	return details.Value
}

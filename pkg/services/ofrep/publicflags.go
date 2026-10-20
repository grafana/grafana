package ofrep

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
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

func (b *APIBuilder) bypassEnabled(ctx context.Context, logger log.Logger) bool {
	if b.goffURL == nil {
		return false
	}

	evalCtx := openfeature.TransactionContext(ctx)

	details, err := openfeature.NewDefaultClient().BooleanValueDetails(
		ctx,
		featuremgmt.FlagFeaturesLegacyOverrideLookupBypass,
		false,
		evalCtx,
	)

	logger.Debug("legacyOverrideLookupBypass evaluation result",
		"value", details.Value,
		"variant", details.Variant,
		"reason", details.Reason,
		"errorCode", details.ErrorCode,
		"errorMessage", details.ErrorMessage,
		"targetingKey", evalCtx.TargetingKey(),
		"attributes", evalCtx.Attributes(),
		"err", err,
	)

	return details.Value
}

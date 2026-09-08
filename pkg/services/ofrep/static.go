package ofrep

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
)

func (b *APIBuilder) evalAllFlagsStatic(ctx context.Context, w http.ResponseWriter) {
	ctx, span := tracing.Start(ctx, "ofrep.static.evalAllFlags")
	defer span.End()
	logger := b.logger.FromContext(ctx)

	result, err := b.staticEvaluator.EvalAllFlags(ctx)
	if err != nil {
		err = tracing.Error(span, err)
		logger.Error("Failed to evaluate all static flags", "error", err)
		http.Error(w, "failed to evaluate flags", http.StatusInternalServerError)
		return
	}

	span.SetAttributes(attribute.Int("total_flags_count", len(result.Flags)))

	writeResponse(http.StatusOK, result, logger, w)
}

func (b *APIBuilder) evalFlagStatic(ctx context.Context, flagKey string, w http.ResponseWriter) {
	ctx, span := tracing.Start(ctx, "ofrep.static.evalFlag")
	defer span.End()
	logger := b.logger.FromContext(ctx)

	span.SetAttributes(attribute.String("flag_key", flagKey))

	result, err := b.staticEvaluator.EvalFlag(ctx, flagKey)
	if err != nil {
		err = tracing.Error(span, err)
		logger.Error("Failed to evaluate static flag", "key", flagKey, "error", err)
		http.Error(w, "failed to evaluate flag", http.StatusInternalServerError)
		return
	}

	writeResponse(http.StatusOK, result, logger, w)
}

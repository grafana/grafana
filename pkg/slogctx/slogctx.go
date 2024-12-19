// Slogctx defines contextual slog utilities, that allow for tying a slog logger with each context.
// Context sources should usually start with a `FromContext(ctx, "logger", "my-module-here")` such that all outputs have a logger attribute.
package slogctx

import (
	"context"
	"log/slog"
)

// key is defined to be a separate type for Context. This is recommended practice, per Context.Value.
type key int

// The loggerKey is the default key in the context. It is a separate type from any other, so no value is necessary. This is recommended practice, per Context.Value.
var loggerKey key

// With returns a Logger that includes the given attributes in each output operation.
// Arguments are converted to attributes as if by [Logger.Log].
// The attached context also includes this new logger.
func With(ctx context.Context, logger *slog.Logger, values ...any) (context.Context, *slog.Logger) {
	if len(values) == 0 {
		return ctx, logger
	}

	logger = logger.With(values...)
	return To(ctx, logger), logger
}

// FromContext fetches the logger from the context, or constructs a new one from slog.Default.
// The output will also include the new values, as if you called With directly after.
func From(ctx context.Context, values ...any) (context.Context, *slog.Logger) {
	logger, ok := ctx.Value(loggerKey).(*slog.Logger)
	if !ok {
		logger = slog.Default()
	}
	ctx = To(ctx, logger)
	return With(ctx, logger, values...)
}

// ToContext writes the logger to a new context wrapping the context given.
// The new context will include all other values, cancellations, etc. as the one given.
func To(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, logger)
}

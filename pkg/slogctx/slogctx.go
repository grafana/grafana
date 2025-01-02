// Slogctx defines contextual slog utilities, that allow for tying a slog logger with each context.
// The package only defines the context-related actions. To add more data to the logger itself, call the `log/slog` functions directly, e.g. With or WithGroup.
package slogctx

import (
	"context"
	"log/slog"
)

// key is defined to be a separate type for Context. This is recommended practice, per Context.Value.
type key int

// The loggerKey is the default key in the context. It is a separate type from any other, so no value is necessary. This is recommended practice, per Context.Value.
var loggerKey key

// FromContext fetches the logger from the context, or constructs a new one from slog.Default.
// To include more values, you may want to call `With` or `WithGroup` directly afterwards.
func From(ctx context.Context) *slog.Logger {
	logger, ok := ctx.Value(loggerKey).(*slog.Logger)
	if !ok {
		return slog.Default()
	}
	return logger
}

// ToContext writes the logger to a new context wrapping the context given.
// The new context will include all other values, cancellations, etc. as the one given.
func To(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, logger)
}

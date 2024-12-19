package plog

import (
	"context"
	"log/slog"
)

type key int

var loggerKey key

type ProvisioningLogger struct {
	*slog.Logger
}

// With returns a ProvisioningLogger that includes the given attributes
// in each output operation. Arguments are converted to
// attributes as if by [Logger.Log].
func (l *ProvisioningLogger) With(ctx context.Context, values ...any) (context.Context, *ProvisioningLogger) {
	pl := *l
	pl.Logger = pl.Logger.With(values...)
	return ToContext(ctx, &pl), &pl
}

// FromContext fetches the logger from the context, or constructs a new one with the fallback.
// The output will also include the new values, as if you called With directly after.
func FromContext(ctx context.Context, fallback *slog.Logger, values ...any) (context.Context, *ProvisioningLogger) {
	logger, ok := ctx.Value(loggerKey).(*ProvisioningLogger)
	if !ok {
		logger = &ProvisioningLogger{Logger: fallback}
	}
	ctx = ToContext(ctx, logger)
	return logger.With(ctx, values...)
}

func ToContext(ctx context.Context, logger *ProvisioningLogger) context.Context {
	return context.WithValue(ctx, loggerKey, logger)
}

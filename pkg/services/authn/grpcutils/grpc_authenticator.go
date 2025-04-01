package grpcutils

import (
	"context"
)

type contextFallbackKey struct{}

func FallbackUsed(ctx context.Context) bool {
	return ctx.Value(contextFallbackKey{}) != nil
}

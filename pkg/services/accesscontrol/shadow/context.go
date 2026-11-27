package shadow

import "context"

type contextKey struct{}

// WithContext marks observational work so downstream authorization can avoid cache writes and recursive delegation.
func WithContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, contextKey{}, true)
}

func IsShadow(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	marked, _ := ctx.Value(contextKey{}).(bool)
	return marked
}

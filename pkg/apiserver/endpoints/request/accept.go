package request

import (
	"context"
)

type acceptHeaderKey struct{}

// WithAcceptHeader adds the accept header to the supplied context.
func WithAcceptHeader(ctx context.Context, acceptHeader string) context.Context {
	// only add the accept header to ctx if it is not empty
	if acceptHeader == "" {
		return ctx
	}
	return context.WithValue(ctx, acceptHeaderKey{}, acceptHeader)
}

// AcceptHeaderFrom returns the accept header from the supplied context and a boolean indicating if the value was present.
func AcceptHeaderFrom(ctx context.Context) (string, bool) {
	acceptHeader, ok := ctx.Value(acceptHeaderKey{}).(string)
	return acceptHeader, ok
}

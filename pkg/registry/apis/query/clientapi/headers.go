package clientapi

import (
	"context"
	"maps"
)

type requestHeadersKey struct{}

// WithRequestHeaders carries backend.QueryDataRequest.Headers to a
// QueryDataClient, since data.QueryDataRequest has no headers field. Headers on
// the incoming HTTP request win over them.
func WithRequestHeaders(ctx context.Context, headers map[string]string) context.Context {
	if len(headers) == 0 {
		return ctx
	}
	return context.WithValue(ctx, requestHeadersKey{}, headers)
}

// RequestHeaders returns a copy of the headers set by WithRequestHeaders, or
// nil if there are none. It copies because the plugin middlewares change the
// request headers.
func RequestHeaders(ctx context.Context) map[string]string {
	headers, _ := ctx.Value(requestHeadersKey{}).(map[string]string)
	return maps.Clone(headers)
}

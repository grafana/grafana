package embedder

import (
	"context"
	"net/http"
)

type queryAttemptContextKey struct{}

// QueryRequestObserver counts actual provider requests, including SDK retries.
type QueryRequestObserver func(QueryAttemptKind)

// WithQueryAttempt identifies the logical attempt at the transport boundary.
func WithQueryAttempt(ctx context.Context, kind QueryAttemptKind) context.Context {
	return context.WithValue(ctx, queryAttemptContextKey{}, kind)
}

// WithEligibleQueryAttempt attributes transport traffic only when the shared
// coordinator starts a logical query attempt for this input.
func (h *QueryHedger) WithEligibleQueryAttempt(ctx context.Context, input EmbedTextInput, kind QueryAttemptKind) context.Context {
	if h == nil || cap(h.slots) == 0 || input.Task != TaskRetrievalQuery || len(input.Texts) != 1 {
		return ctx
	}
	return WithQueryAttempt(ctx, kind)
}

// ObserveQueryRequest counts a dispatched query embedding request when its
// context belongs to an original or extra attempt.
func ObserveQueryRequest(ctx context.Context, observer QueryRequestObserver) {
	if observer == nil || ctx.Err() != nil {
		return
	}
	if kind, ok := ctx.Value(queryAttemptContextKey{}).(QueryAttemptKind); ok {
		observer(kind)
	}
}

// ObservedHTTPClient attributes SDK transport requests to their query attempt.
type ObservedHTTPClient struct {
	Client interface {
		Do(*http.Request) (*http.Response, error)
	}
	Observer QueryRequestObserver
}

func (c *ObservedHTTPClient) Do(req *http.Request) (*http.Response, error) {
	if err := req.Context().Err(); err != nil {
		return nil, err
	}
	ObserveQueryRequest(req.Context(), c.Observer)
	return c.Client.Do(req)
}

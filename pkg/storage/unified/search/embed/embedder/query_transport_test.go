package embedder

import (
	"context"
	"net/http"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

type requestFunc func(*http.Request) (*http.Response, error)

func (f requestFunc) Do(req *http.Request) (*http.Response, error) { return f(req) }

func TestObservedHTTPClientCountsQueryRequestsAtDispatch(t *testing.T) {
	var original, extra atomic.Int32
	var underlying atomic.Int32
	client := &ObservedHTTPClient{Client: requestFunc(func(*http.Request) (*http.Response, error) {
		underlying.Add(1)
		return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
	}), Observer: func(kind QueryAttemptKind) {
		switch kind {
		case QueryAttemptOriginal:
			original.Add(1)
		case QueryAttemptExtra:
			extra.Add(1)
		}
	}}
	for _, ctx := range []context.Context{
		context.Background(),
		WithQueryAttempt(context.Background(), QueryAttemptOriginal),
		WithQueryAttempt(context.Background(), QueryAttemptOriginal),
		WithQueryAttempt(context.Background(), QueryAttemptExtra),
	} {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://example.test/embeddings", nil)
		require.NoError(t, err)
		resp, err := client.Do(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
	}
	canceled, cancel := context.WithCancel(WithQueryAttempt(context.Background(), QueryAttemptExtra))
	cancel()
	req, err := http.NewRequestWithContext(canceled, http.MethodPost, "https://example.test/embeddings", nil)
	require.NoError(t, err)
	resp, err := client.Do(req)
	require.ErrorIs(t, err, context.Canceled)
	if resp != nil {
		require.NoError(t, resp.Body.Close())
	}
	require.Equal(t, int32(2), original.Load())
	require.Equal(t, int32(1), extra.Load())
	require.Equal(t, int32(4), underlying.Load())
}

func TestQueryRequestAttributionRequiresEligibleInput(t *testing.T) {
	hedger, err := NewQueryHedger(1, 1, nil)
	require.NoError(t, err)
	var observed atomic.Int32
	for _, input := range []EmbedTextInput{
		{Texts: []string{"query"}, Task: TaskRetrievalQuery},
		{Texts: []string{"document"}, Task: TaskRetrievalDocument},
		{Texts: []string{"one", "two"}, Task: TaskRetrievalQuery},
	} {
		ctx := hedger.WithEligibleQueryAttempt(context.Background(), input, QueryAttemptOriginal)
		ObserveQueryRequest(ctx, func(QueryAttemptKind) { observed.Add(1) })
	}
	require.Equal(t, int32(1), observed.Load())
}

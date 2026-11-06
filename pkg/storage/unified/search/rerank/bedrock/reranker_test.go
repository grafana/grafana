package bedrock

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

type delayedClient struct {
	calls atomic.Int32
}

func (c *delayedClient) Rerank(ctx context.Context, _, _ string, _ []string) ([]RerankResult, error) {
	if c.calls.Add(1) == 1 {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return []RerankResult{{Index: 0, Score: 0.7}}, nil
}

func TestReranker_UsesConfiguredHedgeDelay(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		fastClient, slowClient := &delayedClient{}, &delayedClient{}
		fast := NewRerankerWithHedgeDelay(fastClient, "m", 250*time.Millisecond)
		slow := NewRerankerWithHedgeDelay(slowClient, "m", 750*time.Millisecond)
		for _, tc := range []struct {
			r      *Reranker
			client *delayedClient
			delay  time.Duration
		}{
			{fast, fastClient, 250 * time.Millisecond},
			{slow, slowClient, 750 * time.Millisecond},
		} {
			start := time.Now()
			scores, err := tc.r.Score(context.Background(), "q", []string{"a"})
			require.NoError(t, err)
			require.Equal(t, []float64{0.7}, scores)
			require.Equal(t, tc.delay, time.Since(start))
			require.EqualValues(t, 2, tc.client.calls.Load())
		}
	})
}

func TestReranker_DefaultConstructorHedgesAfter500ms(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := &delayedClient{}
		start := time.Now()
		_, err := NewReranker(client, "m").Score(context.Background(), "q", []string{"a"})
		require.NoError(t, err)
		require.Equal(t, rerank.DefaultHedgeDelay, time.Since(start))
		require.EqualValues(t, 2, client.calls.Load())
	})
}

type fakeClient struct {
	mu       sync.Mutex
	out      []RerankResult
	err      error
	gotModel string
	gotQuery string
	gotDocs  []string
	respond  func(context.Context, int) ([]RerankResult, error)
	calls    int
}

func (f *fakeClient) Rerank(ctx context.Context, model, query string, documents []string) ([]RerankResult, error) {
	f.mu.Lock()
	f.calls++
	n := f.calls
	f.gotModel, f.gotQuery, f.gotDocs = model, query, append([]string(nil), documents...)
	respond, out, err := f.respond, f.out, f.err
	f.mu.Unlock()
	if respond != nil {
		return respond(ctx, n)
	}
	return out, err
}

func (f *fakeClient) recorded() (int, string, string, []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls, f.gotModel, f.gotQuery, append([]string(nil), f.gotDocs...)
}

func TestReranker_MapsScoresByIndex(t *testing.T) {
	c := &fakeClient{out: []RerankResult{{Index: 1, Score: 0.9}, {Index: 0, Score: 0.2}, {Index: 2, Score: 0.3}}}
	r := NewReranker(c, "cohere.rerank-v3-5:0")

	scores, err := r.Score(context.Background(), "q", []string{"a", "b", "c"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.2, 0.9, 0.3}, scores)
	_, model, query, docs := c.recorded()
	assert.Equal(t, "cohere.rerank-v3-5:0", model)
	assert.Equal(t, "q", query)
	assert.Equal(t, []string{"a", "b", "c"}, docs)
}

func TestReranker_IgnoresOutOfRangeIndices(t *testing.T) {
	c := &fakeClient{out: []RerankResult{{Index: 5, Score: 0.9}, {Index: -1, Score: 0.5}, {Index: 0, Score: 0.1}, {Index: 1, Score: 0.2}}}
	r := NewReranker(c, "m")
	scores, err := r.Score(context.Background(), "q", []string{"a", "b"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.1, 0.2}, scores)
}

func TestReranker_RejectsIncompleteResponse(t *testing.T) {
	for _, tc := range []struct {
		name string
		out  []RerankResult
	}{
		{name: "empty"},
		{name: "partial", out: []RerankResult{{Index: 0, Score: 0.1}}},
		{name: "duplicate does not cover missing index", out: []RerankResult{{Index: 0, Score: 0.1}, {Index: 0, Score: 0.2}, {Index: -1, Score: 0.3}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := NewReranker(&fakeClient{out: tc.out}, "m")
			_, err := r.Score(context.Background(), "q", []string{"a", "b"})
			require.ErrorContains(t, err, "missing score for input")
		})
	}
}

func TestReranker_ZeroScoreStillCoversInput(t *testing.T) {
	r := NewReranker(&fakeClient{out: []RerankResult{{Index: 1, Score: 0}, {Index: 0, Score: 0.4}}}, "m")
	scores, err := r.Score(context.Background(), "q", []string{"a", "b"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.4, 0}, scores)
}

func TestReranker_IncompleteAttemptWaitsForCompletePeer(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := &fakeClient{respond: func(_ context.Context, n int) ([]RerankResult, error) {
			if n == 1 {
				<-time.After(600 * time.Millisecond)
				return []RerankResult{{Index: 0, Score: 0.1}}, nil
			}
			<-time.After(200 * time.Millisecond)
			return []RerankResult{{Index: 1, Score: 0.8}, {Index: 0, Score: 0.4}}, nil
		}}
		scores, err := NewReranker(client, "m").Score(context.Background(), "q", []string{"a", "b"})
		require.NoError(t, err)
		require.Equal(t, []float64{0.4, 0.8}, scores)
		calls, _, _, _ := client.recorded()
		require.Equal(t, 2, calls)
	})
}

func TestReranker_EmptyInput(t *testing.T) {
	r := NewReranker(&fakeClient{}, "m")
	scores, err := r.Score(context.Background(), "q", nil)
	require.NoError(t, err)
	assert.Empty(t, scores)
}

func TestReranker_TooManyDocs(t *testing.T) {
	r := NewReranker(&fakeClient{}, "m")
	docs := make([]string, maxDocsPerCall+1)
	_, err := r.Score(context.Background(), "q", docs)
	assert.Error(t, err)
}

func TestReranker_TimeoutMapsToErrCallTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &fakeClient{respond: func(ctx context.Context, _ int) ([]RerankResult, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		}}
		r := NewReranker(c, "m")
		r.callTimeout = time.Millisecond
		_, err := r.Score(context.Background(), "q", []string{"a"})
		require.ErrorIs(t, err, rerank.ErrCallTimeout)
	})
}

func TestReranker_ClientErrorPassesThrough(t *testing.T) {
	boom := errors.New("boom")
	r := NewReranker(&fakeClient{err: boom}, "m")
	_, err := r.Score(context.Background(), "q", []string{"a"})
	require.ErrorIs(t, err, boom)
}

func TestReranker_TimeoutRetainsEarlierProviderFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		failure := errors.New("invoke unavailable")
		client := &fakeClient{respond: func(ctx context.Context, n int) ([]RerankResult, error) {
			if n == 1 {
				<-time.After(600 * time.Millisecond)
				return nil, failure
			}
			<-ctx.Done()
			return nil, ctx.Err()
		}}
		r := NewReranker(client, "m")
		r.callTimeout = time.Second
		_, err := r.Score(context.Background(), "q", []string{"a"})
		require.ErrorIs(t, err, failure)
		require.ErrorIs(t, err, rerank.ErrCallTimeout)
	})
}

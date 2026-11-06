package bedrock

import (
	"context"
	"errors"
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
	out      []RerankResult
	err      error
	gotModel string
	gotQuery string
	gotDocs  []string
	sleep    time.Duration
}

func (f *fakeClient) Rerank(ctx context.Context, model, query string, documents []string) ([]RerankResult, error) {
	f.gotModel, f.gotQuery, f.gotDocs = model, query, documents
	if f.sleep > 0 {
		select {
		case <-time.After(f.sleep):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return f.out, f.err
}

func TestReranker_MapsScoresByIndex(t *testing.T) {
	c := &fakeClient{out: []RerankResult{{Index: 1, Score: 0.9}, {Index: 0, Score: 0.2}}}
	r := NewReranker(c, "cohere.rerank-v3-5:0")

	scores, err := r.Score(context.Background(), "q", []string{"a", "b", "c"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.2, 0.9, 0}, scores)
	assert.Equal(t, "cohere.rerank-v3-5:0", c.gotModel)
	assert.Equal(t, "q", c.gotQuery)
	assert.Equal(t, []string{"a", "b", "c"}, c.gotDocs)
}

func TestReranker_IgnoresOutOfRangeIndices(t *testing.T) {
	c := &fakeClient{out: []RerankResult{{Index: 5, Score: 0.9}, {Index: -1, Score: 0.5}, {Index: 0, Score: 0.1}}}
	r := NewReranker(c, "m")
	scores, err := r.Score(context.Background(), "q", []string{"a", "b"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.1, 0}, scores)
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
	c := &fakeClient{sleep: 50 * time.Millisecond}
	r := NewReranker(c, "m")
	r.callTimeout = time.Millisecond
	_, err := r.Score(context.Background(), "q", []string{"a"})
	require.ErrorIs(t, err, rerank.ErrCallTimeout)
}

func TestReranker_ClientErrorPassesThrough(t *testing.T) {
	boom := errors.New("boom")
	r := NewReranker(&fakeClient{err: boom}, "m")
	_, err := r.Score(context.Background(), "q", []string{"a"})
	require.ErrorIs(t, err, boom)
}

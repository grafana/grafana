package vertex

import (
	"context"
	"errors"
	"strconv"
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

func (c *delayedClient) Rank(ctx context.Context, _, _ string, _ []string) ([]RecordScore, error) {
	if c.calls.Add(1) == 1 {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return []RecordScore{{ID: "0", Score: 0.7}}, nil
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
	out      []RecordScore
	err      error
	gotModel string
	gotQuery string
	gotTexts []string
	calls    int
	respond  func(context.Context, int) ([]RecordScore, error)
}

func (f *fakeClient) Rank(ctx context.Context, model, query string, texts []string) ([]RecordScore, error) {
	f.mu.Lock()
	f.calls++
	n := f.calls
	f.gotModel, f.gotQuery, f.gotTexts = model, query, append([]string(nil), texts...)
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
	return f.calls, f.gotModel, f.gotQuery, append([]string(nil), f.gotTexts...)
}

func TestReranker_MapsScoresByRecordID(t *testing.T) {
	for _, count := range []int{3, 500} {
		t.Run(strconv.Itoa(count), func(t *testing.T) {
			texts := make([]string, count)
			for i := range texts {
				texts[i] = "text " + strconv.Itoa(i)
			}
			// Out-of-order records map back to the input order.
			recs := make([]RecordScore, count)
			for i := range recs {
				recs[i] = RecordScore{ID: strconv.Itoa(count - 1 - i), Score: 0.2}
			}
			recs[0].Score, recs[count-1].Score = 0.9, 0.4
			c := &fakeClient{out: recs}
			r := NewReranker(c, "semantic-ranker-fast-004")

			scores, err := r.Score(context.Background(), "q", texts)
			require.NoError(t, err)
			want := make([]float64, count)
			for i := range want {
				want[i] = 0.2
			}
			want[0], want[count-1] = 0.4, 0.9
			assert.Equal(t, want, scores)
			calls, model, query, gotTexts := c.recorded()
			assert.Equal(t, 1, calls)
			assert.Equal(t, "semantic-ranker-fast-004", model)
			assert.Equal(t, "q", query)
			assert.Equal(t, texts, gotTexts)
		})
	}
}

func TestReranker_IgnoresUnknownIDs(t *testing.T) {
	c := &fakeClient{out: []RecordScore{{ID: "7", Score: 0.9}, {ID: "x", Score: 0.5}, {ID: "0", Score: 0.1}, {ID: "1", Score: 0.2}}}
	r := NewReranker(c, "m")
	scores, err := r.Score(context.Background(), "q", []string{"a", "b"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.1, 0.2}, scores)
}

func TestReranker_RejectsIncompleteResponse(t *testing.T) {
	for _, tc := range []struct {
		name string
		out  []RecordScore
	}{
		{name: "empty"},
		{name: "partial", out: []RecordScore{{ID: "0", Score: 0.1}}},
		{name: "duplicate does not cover missing ID", out: []RecordScore{{ID: "0", Score: 0.1}, {ID: "0", Score: 0.2}, {ID: "x", Score: 0.3}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := NewReranker(&fakeClient{out: tc.out}, "m")
			_, err := r.Score(context.Background(), "q", []string{"a", "b"})
			require.ErrorContains(t, err, "missing score for input")
		})
	}
}

func TestReranker_ZeroScoreStillCoversInput(t *testing.T) {
	r := NewReranker(&fakeClient{out: []RecordScore{{ID: "1", Score: 0}, {ID: "0", Score: 0.4}}}, "m")
	scores, err := r.Score(context.Background(), "q", []string{"a", "b"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.4, 0}, scores)
}

func TestReranker_IncompleteAttemptWaitsForCompletePeer(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := &fakeClient{respond: func(_ context.Context, n int) ([]RecordScore, error) {
			if n == 1 {
				<-time.After(600 * time.Millisecond)
				return []RecordScore{{ID: "0", Score: 0.1}}, nil
			}
			<-time.After(200 * time.Millisecond)
			return []RecordScore{{ID: "1", Score: 0.8}, {ID: "0", Score: 0.4}}, nil
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

func TestReranker_TooManyTexts(t *testing.T) {
	r := NewReranker(&fakeClient{}, "m")
	texts := make([]string, maxRecordsPerCall+1)
	_, err := r.Score(context.Background(), "q", texts)
	assert.Error(t, err)
}

func TestReranker_TimeoutMapsToErrCallTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		c := &fakeClient{respond: func(ctx context.Context, _ int) ([]RecordScore, error) {
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
		failure := errors.New("rank unavailable")
		client := &fakeClient{respond: func(ctx context.Context, n int) ([]RecordScore, error) {
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

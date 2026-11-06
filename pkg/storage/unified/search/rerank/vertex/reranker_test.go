package vertex

import (
	"context"
	"errors"
	"strconv"
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
	out      []RecordScore
	err      error
	gotModel string
	gotQuery string
	gotTexts []string
	calls    int
	sleep    time.Duration
}

func (f *fakeClient) Rank(ctx context.Context, model, query string, texts []string) ([]RecordScore, error) {
	f.calls++
	f.gotModel, f.gotQuery, f.gotTexts = model, query, texts
	if f.sleep > 0 {
		select {
		case <-time.After(f.sleep):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return f.out, f.err
}

func TestReranker_MapsScoresByRecordID(t *testing.T) {
	for _, count := range []int{3, 500} {
		t.Run(strconv.Itoa(count), func(t *testing.T) {
			texts := make([]string, count)
			for i := range texts {
				texts[i] = "text " + strconv.Itoa(i)
			}
			// Out-of-order records map back to the input order; omitted records stay zero.
			c := &fakeClient{out: []RecordScore{{ID: strconv.Itoa(count - 1), Score: 0.9}, {ID: "0", Score: 0.4}}}
			r := NewReranker(c, "semantic-ranker-fast-004")

			scores, err := r.Score(context.Background(), "q", texts)
			require.NoError(t, err)
			want := make([]float64, count)
			want[0], want[count-1] = 0.4, 0.9
			assert.Equal(t, want, scores)
			assert.Equal(t, 1, c.calls)
			assert.Equal(t, "semantic-ranker-fast-004", c.gotModel)
			assert.Equal(t, "q", c.gotQuery)
			assert.Equal(t, texts, c.gotTexts)
		})
	}
}

func TestReranker_IgnoresUnknownIDs(t *testing.T) {
	c := &fakeClient{out: []RecordScore{{ID: "7", Score: 0.9}, {ID: "x", Score: 0.5}, {ID: "0", Score: 0.1}}}
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

func TestReranker_TooManyTexts(t *testing.T) {
	r := NewReranker(&fakeClient{}, "m")
	texts := make([]string, maxRecordsPerCall+1)
	_, err := r.Score(context.Background(), "q", texts)
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

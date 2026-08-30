package vertex

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

type fakeClient struct {
	out      []RecordScore
	err      error
	gotModel string
	gotQuery string
	gotTexts []string
	sleep    time.Duration
}

func (f *fakeClient) Rank(ctx context.Context, model, query string, texts []string) ([]RecordScore, error) {
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
	// out of order + one missing id: missing stays 0
	c := &fakeClient{out: []RecordScore{{ID: "2", Score: 0.9}, {ID: "0", Score: 0.4}}}
	r := NewReranker(c, "semantic-ranker-fast-004")

	scores, err := r.Score(context.Background(), "q", []string{"a", "b", "c"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.4, 0, 0.9}, scores)
	assert.Equal(t, "semantic-ranker-fast-004", c.gotModel)
	assert.Equal(t, "q", c.gotQuery)
	assert.Equal(t, []string{"a", "b", "c"}, c.gotTexts)
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

package rerank

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeScorer struct {
	scores []float64
	err    error
	gotQ   string
	gotN   int
}

func (f *fakeScorer) Score(_ context.Context, query string, texts []string) ([]float64, error) {
	f.gotQ, f.gotN = query, len(texts)
	return f.scores, f.err
}

func TestInstrument_PassThroughAndMetrics(t *testing.T) {
	hist := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name: "test_rerank_duration_seconds",
	}, []string{"model", "status"})

	inner := &fakeScorer{scores: []float64{0.9, 0.1}}
	s := Instrument(inner, "vertex/m", hist)

	out, err := s.Score(context.Background(), "q", []string{"a", "b"})
	require.NoError(t, err)
	assert.Equal(t, []float64{0.9, 0.1}, out)
	assert.Equal(t, "q", inner.gotQ)
	assert.Equal(t, 2, inner.gotN)
	assert.Equal(t, 1, testutil.CollectAndCount(hist))

	inner.err = errors.New("boom")
	_, err = s.Score(context.Background(), "q", []string{"a"})
	require.Error(t, err)
	// ok + error series both present now
	assert.Equal(t, 2, testutil.CollectAndCount(hist))
}

func TestInstrument_TimeoutStatus(t *testing.T) {
	hist := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name: "test_rerank_duration_timeout_seconds",
	}, []string{"model", "status"})
	inner := &fakeScorer{err: ErrCallTimeout}
	s := Instrument(inner, "m", hist)
	_, err := s.Score(context.Background(), "q", []string{"a"})
	require.ErrorIs(t, err, ErrCallTimeout)
	// exactly the timeout series exists
	assert.Equal(t, 1, testutil.CollectAndCount(hist))
}

func TestInstrument_NilHistogram(t *testing.T) {
	s := Instrument(&fakeScorer{scores: []float64{1}}, "m", nil)
	out, err := s.Score(context.Background(), "q", []string{"a"})
	require.NoError(t, err)
	assert.Equal(t, []float64{1}, out)
}

package embedder

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// instrumentFakeEmbedder returns a fixed output/error so tests can assert on
// what Instrument does with it, independent of any real provider.
type instrumentFakeEmbedder struct {
	out EmbedTextOutput
	err error
}

func (f *instrumentFakeEmbedder) EmbedText(_ context.Context, _ EmbedTextInput) (EmbedTextOutput, error) {
	return f.out, f.err
}

func TestInstrument_TokensCounter_AccumulatesAcrossCalls(t *testing.T) {
	tokens := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "test_embed_tokens_total",
	}, []string{"model", "task"})

	inner := &instrumentFakeEmbedder{out: EmbedTextOutput{InputTokens: 42}}
	s := Instrument(inner, "vertex/m", nil, tokens)

	_, err := s.EmbedText(context.Background(), EmbedTextInput{Task: TaskRetrievalDocument})
	require.NoError(t, err)
	assert.Equal(t, float64(42), testutil.ToFloat64(tokens.WithLabelValues("vertex/m", string(TaskRetrievalDocument))))

	_, err = s.EmbedText(context.Background(), EmbedTextInput{Task: TaskRetrievalDocument})
	require.NoError(t, err)
	assert.Equal(t, float64(84), testutil.ToFloat64(tokens.WithLabelValues("vertex/m", string(TaskRetrievalDocument))))
}

func TestInstrument_TokensCounter_LabeledByTask(t *testing.T) {
	tokens := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "test_embed_tokens_total_by_task",
	}, []string{"model", "task"})

	inner := &instrumentFakeEmbedder{out: EmbedTextOutput{InputTokens: 10}}
	s := Instrument(inner, "m", nil, tokens)

	_, err := s.EmbedText(context.Background(), EmbedTextInput{Task: TaskRetrievalQuery})
	require.NoError(t, err)
	assert.Equal(t, float64(10), testutil.ToFloat64(tokens.WithLabelValues("m", string(TaskRetrievalQuery))))
	assert.Equal(t, float64(0), testutil.ToFloat64(tokens.WithLabelValues("m", string(TaskRetrievalDocument))))
}

func TestInstrument_ErrorDoesNotIncrementTokens(t *testing.T) {
	tokens := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "test_embed_tokens_total_err",
	}, []string{"model", "task"})

	inner := &instrumentFakeEmbedder{err: errors.New("boom")}
	s := Instrument(inner, "m", nil, tokens)

	_, err := s.EmbedText(context.Background(), EmbedTextInput{})
	require.Error(t, err)
	assert.Equal(t, 0, testutil.CollectAndCount(tokens))
}

func TestInstrument_NilMetricsSafe(t *testing.T) {
	inner := &instrumentFakeEmbedder{out: EmbedTextOutput{InputTokens: 10}}
	s := Instrument(inner, "m", nil, nil)

	out, err := s.EmbedText(context.Background(), EmbedTextInput{})
	require.NoError(t, err)
	assert.Equal(t, 10, out.InputTokens, "output passes through unmodified when metrics are nil")
}

package vertex

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// fakeClient records calls and returns synthetic vectors.
type fakeClient struct {
	mu        sync.Mutex
	calls     [][]string // texts per call, in arrival order
	dim       int
	tokens    int   // tokens to report per call
	failAfter int32 // -1 = never; otherwise fail on the Nth call (1-indexed)
	callNum   int32
	wantTask  string // last task type seen
}

func (f *fakeClient) PredictEmbeddings(_ context.Context, _ string, texts []string, _ int, taskType string) (EmbeddingResult, error) {
	n := atomic.AddInt32(&f.callNum, 1)
	f.mu.Lock()
	f.calls = append(f.calls, texts)
	f.wantTask = taskType
	f.mu.Unlock()

	if f.failAfter > 0 && n == f.failAfter {
		return EmbeddingResult{}, errors.New("synthetic failure")
	}

	res := EmbeddingResult{
		Vectors:     make([][]float32, len(texts)),
		InputTokens: f.tokens,
	}
	for i := range texts {
		v := make([]float32, f.dim)
		// distinguish by length so we can verify ordering across batches
		v[0] = float32(len(texts[i]))
		res.Vectors[i] = v
	}
	return res, nil
}

func TestDenseEmbedder_EmbedText_ChunksAtBatchSize(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "text-embedding-005", 0)

	// 600 inputs → 3 chunks (250 + 250 + 100).
	texts := make([]string, 600)
	for i := range texts {
		texts[i] = "x"
	}
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: texts})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 600)

	fc.mu.Lock()
	chunks := len(fc.calls)
	sizes := make([]int, len(fc.calls))
	for i, c := range fc.calls {
		sizes[i] = len(c)
	}
	fc.mu.Unlock()

	assert.Equal(t, 3, chunks)
	// Concurrent dispatch — sort sizes for deterministic comparison.
	assert.ElementsMatch(t, []int{250, 250, 100}, sizes)
}

func TestDenseEmbedder_EmbedText_PassesTaskType(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "text-embedding-005", 0)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{
		Texts: []string{"a"},
		Task:  embedder.TaskRetrievalQuery,
	})
	require.NoError(t, err)
	assert.Equal(t, "RETRIEVAL_QUERY", fc.wantTask)
}

func TestDenseEmbedder_EmbedText_DefaultsToDocumentTask(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "text-embedding-005", 0)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"a"}})
	require.NoError(t, err)
	assert.Equal(t, "RETRIEVAL_DOCUMENT", fc.wantTask)
}

func TestDenseEmbedder_EmbedText_NormalizesWhenAsked(t *testing.T) {
	// fake returns vectors with first element == len(text); normalization should
	// scale to unit length.
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "text-embedding-005", 0)
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{
		Texts:     []string{"abcd"},
		Normalize: true,
	})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 1)
	v := out.Embeddings[0].Dense
	// Pre-normalize: [4, 0, 0]; post: [1, 0, 0].
	assert.InDelta(t, 1.0, v[0], 1e-6)
	assert.Equal(t, float32(0), v[1])
}

func TestDenseEmbedder_EmbedText_EmptyInput(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "text-embedding-005", 0)
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{})
	require.NoError(t, err)
	assert.Empty(t, out.Embeddings)
	assert.Empty(t, fc.calls, "no client call when no texts")
}

func TestDenseEmbedder_EmbedText_PropagatesError(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: 1}
	e := NewDenseEmbedder(fc, "text-embedding-005", 0)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"a", "b"}})
	require.Error(t, err)
}

package bedrock

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

type fakeClient struct {
	mu        sync.Mutex
	calls     [][]string
	dim       int
	tokens    int
	failAfter int32
	callNum   int32
	wantInput string
}

func (f *fakeClient) EmbedTexts(_ context.Context, _ string, texts []string, inputType string, _ int) (EmbedResult, error) {
	n := atomic.AddInt32(&f.callNum, 1)
	f.mu.Lock()
	f.calls = append(f.calls, texts)
	f.wantInput = inputType
	f.mu.Unlock()

	if f.failAfter > 0 && n == f.failAfter {
		return EmbedResult{}, errors.New("synthetic failure")
	}
	res := EmbedResult{
		Vectors:     make([][]float32, len(texts)),
		InputTokens: f.tokens,
	}
	for i := range texts {
		v := make([]float32, f.dim)
		v[0] = float32(len(texts[i]))
		res.Vectors[i] = v
	}
	return res, nil
}

func TestDenseEmbedder_EmbedText_ChunksAt96(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0)

	// 200 inputs → 3 chunks (96 + 96 + 8).
	texts := make([]string, 200)
	for i := range texts {
		texts[i] = "x"
	}
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: texts})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 200)

	fc.mu.Lock()
	sizes := make([]int, len(fc.calls))
	for i, c := range fc.calls {
		sizes[i] = len(c)
	}
	fc.mu.Unlock()
	assert.ElementsMatch(t, []int{96, 96, 8}, sizes)
}

func TestDenseEmbedder_EmbedText_PassesInputType(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0)

	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{
		Texts: []string{"a"},
		Task:  embedder.TaskRetrievalQuery,
	})
	require.NoError(t, err)
	assert.Equal(t, "search_query", fc.wantInput)
}

func TestDenseEmbedder_EmbedText_DefaultsToSearchDocument(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"a"}})
	require.NoError(t, err)
	assert.Equal(t, "search_document", fc.wantInput)
}

func TestDenseEmbedder_EmbedText_NormalizesWhenAsked(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0)
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{
		Texts:     []string{"abcd"},
		Normalize: true,
	})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 1)
	v := out.Embeddings[0].Dense
	assert.InDelta(t, 1.0, v[0], 1e-6)
	assert.Equal(t, float32(0), v[1])
}

func TestDenseEmbedder_EmbedText_EmptyInput(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0)
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{})
	require.NoError(t, err)
	assert.Empty(t, out.Embeddings)
	assert.Empty(t, fc.calls)
}

func TestDenseEmbedder_EmbedText_PropagatesError(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: 1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"a", "b"}})
	require.Error(t, err)
}

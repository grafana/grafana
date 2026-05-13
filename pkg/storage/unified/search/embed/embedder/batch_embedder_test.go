package embedder

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
)

// fakeTextEmbedder returns a deterministic dense vector per input text so
// tests can verify ordering and pass-through.
type fakeTextEmbedder struct {
	dim     int
	gotIn   EmbedTextInput
	wantErr error
}

func (f *fakeTextEmbedder) EmbedText(_ context.Context, in EmbedTextInput) (EmbedTextOutput, error) {
	f.gotIn = in
	if f.wantErr != nil {
		return EmbedTextOutput{}, f.wantErr
	}
	out := make([]Embedding, len(in.Texts))
	for i := range in.Texts {
		v := make([]float32, f.dim)
		v[0] = float32(i + 1) // distinguish per-text
		out[i] = Embedding{Dense: v}
	}
	return EmbedTextOutput{Embeddings: out}, nil
}

func newTestEmbedder(client TextEmbedder) Embedder {
	return Embedder{
		TextEmbedder: client,
		Model:        "test/model-1",
		VectorType:   VectorTypeDense,
		Metric:       CosineDistance,
		Dimensions:   3,
		Normalized:   true, // skip client-side normalize in tests
	}
}

func TestBatchEmbedder_Embed_MapsItemsToVectors(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 3}
	be := NewBatchEmbedder(newTestEmbedder(fake))

	items := []embed.Item{
		{UID: "dash-1", Title: "API — p99", Subresource: "panel/1", Content: "panel one body", Folder: "folder-prod", Metadata: []byte(`{"a":1}`)},
		{UID: "dash-1", Title: "API — 5xx", Subresource: "panel/2", Content: "panel two body", Folder: "folder-prod"},
	}

	vecs, err := be.Embed(context.Background(), "default", "dashboards", 42, items)
	require.NoError(t, err)
	require.Len(t, vecs, 2)

	// First Vector — every field stamped through, embedding lined up.
	v0 := vecs[0]
	assert.Equal(t, "default", v0.Namespace)
	assert.Equal(t, "dashboards", v0.Resource)
	assert.Equal(t, "dash-1", v0.UID)
	assert.Equal(t, "API — p99", v0.Title)
	assert.Equal(t, "panel/1", v0.Subresource)
	assert.Equal(t, int64(42), v0.ResourceVersion)
	assert.Equal(t, "folder-prod", v0.Folder)
	assert.Equal(t, "panel one body", v0.Content)
	assert.JSONEq(t, `{"a":1}`, string(v0.Metadata))
	assert.Equal(t, "test/model-1", v0.Model)
	assert.Equal(t, []float32{1, 0, 0}, v0.Embedding)

	// Second Vector — distinguish from first via embedding.
	assert.Equal(t, "panel/2", vecs[1].Subresource)
	assert.Equal(t, []float32{2, 0, 0}, vecs[1].Embedding)

	// Provider got both texts in order; Task and Normalize set as expected.
	assert.Equal(t, []string{"panel one body", "panel two body"}, fake.gotIn.Texts)
	assert.Equal(t, TaskRetrievalDocument, fake.gotIn.Task)
	assert.False(t, fake.gotIn.Normalize, "Normalized=true on Embedder should skip client-side normalize")
}

func TestBatchEmbedder_Embed_DropsEmptyContent(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 3}
	be := NewBatchEmbedder(newTestEmbedder(fake))

	items := []embed.Item{
		{UID: "u", Subresource: "panel/1", Content: "real text"},
		{UID: "u", Subresource: "panel/2", Content: ""},
		{UID: "u", Subresource: "panel/3", Content: "more text"},
	}
	vecs, err := be.Embed(context.Background(), "ns", "dashboards", 1, items)
	require.NoError(t, err)
	require.Len(t, vecs, 2)
	assert.Equal(t, "panel/1", vecs[0].Subresource)
	assert.Equal(t, "panel/3", vecs[1].Subresource)
	// Provider only saw the two non-empty texts.
	assert.Equal(t, []string{"real text", "more text"}, fake.gotIn.Texts)
}

func TestBatchEmbedder_Embed_AllEmptyReturnsNil(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 3}
	be := NewBatchEmbedder(newTestEmbedder(fake))

	vecs, err := be.Embed(context.Background(), "ns", "dashboards", 1, []embed.Item{
		{UID: "u", Subresource: "panel/1", Content: ""},
	})
	require.NoError(t, err)
	assert.Nil(t, vecs)
	assert.Empty(t, fake.gotIn.Texts, "no provider call when nothing to embed")
}

func TestBatchEmbedder_Embed_NormalizeWhenProviderDoesnt(t *testing.T) {
	fake := &fakeTextEmbedder{dim: 3}
	e := newTestEmbedder(fake)
	e.Normalized = false // provider does not normalize → ask client-side
	be := NewBatchEmbedder(e)

	_, err := be.Embed(context.Background(), "ns", "dashboards", 1, []embed.Item{{Content: "x"}})
	require.NoError(t, err)
	assert.True(t, fake.gotIn.Normalize)
}

func TestBatchEmbedder_Embed_ProviderError(t *testing.T) {
	wantErr := errors.New("upstream blew up")
	be := NewBatchEmbedder(newTestEmbedder(&fakeTextEmbedder{dim: 3, wantErr: wantErr}))

	_, err := be.Embed(context.Background(), "ns", "dashboards", 1, []embed.Item{{Content: "x"}})
	require.Error(t, err)
	assert.ErrorIs(t, err, wantErr)
}

func TestBatchEmbedder_Embed_MismatchedResultLength(t *testing.T) {
	// Provider returns the wrong number of embeddings — surface a clear error.
	bad := &lengthMismatchingEmbedder{returnCount: 1}
	be := NewBatchEmbedder(newTestEmbedder(bad))

	_, err := be.Embed(context.Background(), "ns", "dashboards", 1, []embed.Item{
		{Content: "a"}, {Content: "b"},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "1 embeddings for 2 texts")
}

type lengthMismatchingEmbedder struct{ returnCount int }

func (l *lengthMismatchingEmbedder) EmbedText(_ context.Context, _ EmbedTextInput) (EmbedTextOutput, error) {
	out := make([]Embedding, l.returnCount)
	for i := range out {
		out[i] = Embedding{Dense: []float32{0, 0, 0}}
	}
	return EmbedTextOutput{Embeddings: out}, nil
}

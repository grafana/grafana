package embedder

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// BatchEmbedder turns a slice of extractor Items into a slice of
// vector.Vector rows ready for the pgvector backend. It bundles the call
// to the embedding provider with the Item-to-Vector mapping so callers
// (the orchestrator) hand it Items + namespace/resource/RV and get back
// fully-populated Vectors.
//
// Provider-side chunking is internal to the underlying TextEmbedder, so
// the caller can pass arbitrarily large slices without worrying about
// per-provider batch limits.
type BatchEmbedder struct {
	embedder Embedder
}

// NewBatchEmbedder constructs a BatchEmbedder around a configured Embedder.
func NewBatchEmbedder(e Embedder) *BatchEmbedder {
	return &BatchEmbedder{embedder: e}
}

// Embed returns one Vector per item with non-empty Content. Items with
// empty Content are dropped (the extractor already filters these, but be
// defensive in case a future caller doesn't).
//
// namespace, resource, and rv are stamped onto every returned Vector;
// they're not derivable from the Item alone.
func (b *BatchEmbedder) Embed(
	ctx context.Context,
	namespace, resource string,
	rv int64,
	items []embed.Item,
) ([]vector.Vector, error) {
	// Filter empties up-front so output indices line up with the embedded
	// texts.
	kept := make([]embed.Item, 0, len(items))
	for _, it := range items {
		if it.Content == "" {
			continue
		}
		kept = append(kept, it)
	}
	if len(kept) == 0 {
		return nil, nil
	}

	texts := make([]string, len(kept))
	for i, it := range kept {
		texts[i] = it.Content
	}

	out, err := b.embedder.EmbedText(ctx, EmbedTextInput{
		Texts:     texts,
		Normalize: b.embedder.ShouldNormalize(),
		Task:      TaskRetrievalDocument,
	})
	if err != nil {
		return nil, fmt.Errorf("embed batch: %w", err)
	}
	if len(out.Embeddings) != len(kept) {
		return nil, fmt.Errorf("embedder returned %d embeddings for %d texts", len(out.Embeddings), len(kept))
	}

	vectors := make([]vector.Vector, len(kept))
	for i, it := range kept {
		vectors[i] = vector.Vector{
			Namespace:       namespace,
			Resource:        resource,
			UID:             it.UID,
			Title:           it.Title,
			Subresource:     it.Subresource,
			ResourceVersion: rv,
			Folder:          it.Folder,
			Content:         it.Content,
			Metadata:        it.Metadata,
			Embedding:       out.Embeddings[i].Dense,
			Model:           b.embedder.Model,
		}
	}
	return vectors, nil
}

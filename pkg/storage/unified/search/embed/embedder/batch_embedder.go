package embedder

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// BatchEmbedder turns a slice of extractor Items into a slice of
// vector.Vector rows ready for the pgvector backend. It bundles the call
// to the embedding provider with the Item-to-Vector mapping so callers
// (the resource embedder) hand it Items + namespace/resource/RV and get back
// fully-populated Vectors.
//
// Provider-side chunking is internal to the underlying TextEmbedder, so
// the caller can pass arbitrarily large slices without worrying about
// per-provider batch limits.
type BatchEmbedder struct {
	embedder Embedder
}

// ResourceInput keeps an object's metadata with its chunks so provider batches
// can cross object boundaries without changing the per-object write boundary.
type ResourceInput struct {
	Namespace       string
	ResourceVersion int64
	Items           []embed.Item
}

// NewBatchEmbedder constructs a BatchEmbedder around a configured Embedder.
func NewBatchEmbedder(e Embedder) *BatchEmbedder {
	return &BatchEmbedder{embedder: e}
}

// Embed returns one Vector per item with non-empty Content. Items with
// empty Content are dropped (the extractor already filters these, but be
// defensive in case a future caller doesn't).
//
// namespace, resource, rv, and contentVersion (the calling Builder's Version()) are stamped onto every returned Vector.
func (b *BatchEmbedder) Embed(
	ctx context.Context,
	namespace, resource string,
	rv int64,
	contentVersion int,
	items []embed.Item,
) ([]vector.Vector, error) {
	vectors, err := b.EmbedResources(ctx, resource, contentVersion, []ResourceInput{{
		Namespace:       namespace,
		ResourceVersion: rv,
		Items:           items,
	}})
	if err != nil {
		return nil, err
	}
	return vectors[0], nil
}

// EmbedResources batches chunks across objects of one resource type and builder
// version. Results retain input object order, including nil entries for objects
// without content, so callers can save each object atomically.
func (b *BatchEmbedder) EmbedResources(
	ctx context.Context,
	resource string,
	contentVersion int,
	resources []ResourceInput,
) ([][]vector.Vector, error) {
	itemCount := 0
	for _, input := range resources {
		itemCount += len(input.Items)
	}
	texts := make([]string, 0, itemCount)
	counts := make([]int, len(resources))
	for i, input := range resources {
		for _, it := range input.Items {
			if it.Content != "" {
				texts = append(texts, it.Content)
				counts[i]++
			}
		}
	}
	vectors := make([][]vector.Vector, len(resources))
	if len(texts) == 0 {
		return vectors, nil
	}

	out, err := b.embedder.EmbedText(ctx, EmbedTextInput{
		Texts:     texts,
		Normalize: b.embedder.ShouldNormalize(),
		Task:      TaskRetrievalDocument,
	})
	if err != nil {
		return nil, fmt.Errorf("embed batch: %w", err)
	}
	if len(out.Embeddings) != len(texts) {
		return nil, fmt.Errorf("embedder returned %d embeddings for %d texts", len(out.Embeddings), len(texts))
	}

	embeddingIndex := 0
	for i, input := range resources {
		if counts[i] == 0 {
			continue
		}
		vectors[i] = make([]vector.Vector, 0, counts[i])
		for _, it := range input.Items {
			if it.Content == "" {
				continue
			}
			vectors[i] = append(vectors[i], vector.Vector{
				Namespace:       input.Namespace,
				Resource:        resource,
				UID:             it.UID,
				Title:           it.Title,
				Subresource:     it.Subresource,
				ResourceVersion: input.ResourceVersion,
				Folder:          it.Folder,
				Content:         it.Content,
				Metadata:        it.Metadata,
				Embedding:       out.Embeddings[embeddingIndex].Dense,
				Model:           b.embedder.Model,
				ContentVersion:  contentVersion,
			})
			embeddingIndex++
		}
	}
	return vectors, nil
}

func (b *BatchEmbedder) Model() string {
	return b.embedder.Model
}

// RetryableError identifies a transient embedding failure. Callers can use
// errors.As to schedule a retry while errors.Is/As still reach the cause.
type RetryableError struct {
	Err error
	// RetryAfter is the provider's suggested minimum delay; zero means no hint.
	RetryAfter time.Duration
}

func (e *RetryableError) Error() string {
	return fmt.Sprintf("embedding provider temporarily unavailable: %v", e.Err)
}

func (e *RetryableError) Unwrap() error { return e.Err }

package semantic

import "context"

// EmbeddingProvider generates vector embeddings from text.
type EmbeddingProvider interface {
	// EmbedTexts generates embedding vectors for the given texts.
	// Returns one []float32 per input text, in the same order.
	EmbedTexts(ctx context.Context, texts []string) ([][]float32, error)

	// Dimensions returns the dimensionality of the embedding vectors.
	Dimensions() int
}

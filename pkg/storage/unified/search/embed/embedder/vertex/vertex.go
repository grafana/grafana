// Package vertex implements an embedder.TextEmbedder backed by Google
// Vertex AI's text embedding models.
package vertex

import (
	"context"
	"errors"
)

// ErrCallTimeout is the cause to use with context.WithTimeoutCause when
// imposing a per-call deadline. Wrapping with this sentinel lets callers
// distinguish a per-call timeout from a parent-context cancellation.
var ErrCallTimeout = errors.New("vertex AI call timeout")

// EmbeddingResult is one provider call's output.
type EmbeddingResult struct {
	Vectors [][]float32
	// InputTokens is the sum of token counts across predictions
	InputTokens int
}

// Client is the SDK-facing dependency of DenseEmbedder. The real
// implementation in client.go wraps cloud.google.com/go/aiplatform; tests
// supply a mock.
type Client interface {
	PredictEmbeddings(ctx context.Context, model string, texts []string, dim int, taskType string) (EmbeddingResult, error)
}

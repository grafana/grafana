// Package azure implements an embedder.TextEmbedder backed by Azure OpenAI
// embeddings deployments (e.g. text-embedding-3-large).
package azure

import (
	"context"
	"errors"
)

// ErrCallTimeout is the cause to use with context.WithTimeoutCause when
// imposing a per-call deadline. Wrapping with this sentinel lets callers
// distinguish a per-call timeout from a parent-context cancellation.
var ErrCallTimeout = errors.New("azure OpenAI call timeout")

// EmbedResult is one provider call's output.
type EmbedResult struct {
	Vectors     [][]float32
	InputTokens int
}

// Client is the API-facing dependency of DenseEmbedder. The real
// implementation in client.go calls the Azure OpenAI embeddings REST API;
// tests supply a mock.
type Client interface {
	EmbedTexts(ctx context.Context, texts []string, dimensions int) (EmbedResult, error)
}

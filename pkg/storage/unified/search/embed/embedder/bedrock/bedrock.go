// Package bedrock implements an embedder.TextEmbedder backed by AWS
// Bedrock's embedding models (e.g. Cohere embed-v4).
package bedrock

import (
	"context"
	"errors"
)

// ErrCallTimeout is the cause to use with context.WithTimeoutCause when
// imposing a per-call deadline. Callers can errors.Is(err, ErrCallTimeout)
// to distinguish a per-call timeout from a parent-context cancellation.
var ErrCallTimeout = errors.New("bedrock call timeout")

// EmbedResult is one provider call's output.
type EmbedResult struct {
	Vectors     [][]float32
	InputTokens int
}

// Client is the SDK-facing dependency of DenseEmbedder. The real
// implementation in client.go wraps aws-sdk-go-v2/service/bedrockruntime;
// tests supply a mock.
type Client interface {
	EmbedTexts(ctx context.Context, model string, texts []string, inputType string, outputDimension int) (EmbedResult, error)
}

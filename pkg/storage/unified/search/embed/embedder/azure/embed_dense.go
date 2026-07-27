package azure

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

const callTimeout = 30 * time.Second

// DenseEmbedder embeds text via the Azure OpenAI embeddings API and returns
// dense float32 vectors.
type DenseEmbedder struct {
	client    Client
	dim       int
	batchSize int
}

var _ embedder.TextEmbedder = (*DenseEmbedder)(nil)

// NewDenseEmbedder builds a DenseEmbedder. dim is the requested output
// dimensionality (0 = the deployment's native size); batchSize is the number
// of texts per embeddings call.
func NewDenseEmbedder(client Client, dim, batchSize int) *DenseEmbedder {
	return &DenseEmbedder{
		client:    client,
		dim:       dim,
		batchSize: batchSize,
	}
}

// EmbedText splits inputs into batches sized to e.batchSize, calls the Azure
// OpenAI client per batch, optionally L2-normalizes, and returns embeddings
// 1:1 with input.Texts. Azure OpenAI embeddings are symmetric, so the Task
// hint (query vs document) is not used.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}

	results, err := embedder.BatchProcess(ctx, input.Texts, e.batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
		callCtx, cancel := context.WithTimeoutCause(ctx, callTimeout, ErrCallTimeout)
		defer cancel()

		res, err := e.client.EmbedTexts(callCtx, texts, e.dim)
		if err != nil {
			if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
				return nil, ErrCallTimeout
			}
			return nil, err
		}
		if len(res.Vectors) != len(texts) {
			return nil, fmt.Errorf("azure: got %d vectors for %d inputs", len(res.Vectors), len(texts))
		}
		if input.Normalize {
			embedder.NormalizeDenseBatch(res.Vectors)
		}
		out := make([]embedder.Embedding, len(res.Vectors))
		for i, v := range res.Vectors {
			out[i] = embedder.Embedding{Dense: v}
		}
		return out, nil
	})
	if err != nil {
		return embedder.EmbedTextOutput{}, err
	}
	return embedder.EmbedTextOutput{Embeddings: results}, nil
}

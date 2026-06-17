package bedrock

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// callTimeout bounds the whole per-batch InvokeModel attempt sequence (the
// AWS SDK respects the context deadline across retries). Sized to give the
// adaptive retryer room to back off and retry under throttling rather than
// being cut short mid-sequence.
const callTimeout = 60 * time.Second

// DenseEmbedder embeds text via Bedrock InvokeModel and returns dense
// float32 vectors.
type DenseEmbedder struct {
	client    Client
	model     string
	dim       int
	batchSize int
}

var _ embedder.TextEmbedder = (*DenseEmbedder)(nil)

func NewDenseEmbedder(client Client, model string, dim, batchSize int) *DenseEmbedder {
	return &DenseEmbedder{
		client:    client,
		model:     model,
		dim:       dim,
		batchSize: batchSize,
	}
}

// EmbedText splits inputs into batches sized to e.batchSize, calls the
// Bedrock client concurrently per batch, optionally L2-normalizes, and
// returns embeddings 1:1 with input.Texts.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}
	inputType := cohereInputType(input.Task)

	results, err := embedder.BatchProcess(ctx, input.Texts, e.batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
		callCtx, cancel := context.WithTimeoutCause(ctx, callTimeout, ErrCallTimeout)
		defer cancel()

		res, err := e.client.EmbedTexts(callCtx, e.model, texts, inputType, e.dim)
		if err != nil {
			if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
				return nil, ErrCallTimeout
			}
			return nil, err
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

// cohereInputType maps generic task names to Cohere's input_type values.
// See https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed.html
func cohereInputType(t embedder.Task) string {
	switch t {
	case embedder.TaskRetrievalQuery:
		return "search_query"
	case embedder.TaskRetrievalDocument:
		return "search_document"
	default:
		return "search_document"
	}
}

package bedrock

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// Cohere embed-v4 (and embed-english-v3) accepts up to 96 texts per
// invocation. This is the default for our DenseEmbedder.
const batchSize = 96

// callTimeout is the per-RPC deadline. Bedrock's invoke is generally fast;
// 30s leaves room for cold start without papering over real hangs.
const callTimeout = 30 * time.Second

// DenseEmbedder embeds text via Bedrock InvokeModel and returns dense
// float32 vectors.
type DenseEmbedder struct {
	client Client
	model  string
	dim    int
}

var _ embedder.TextEmbedder = (*DenseEmbedder)(nil)

// NewDenseEmbedder builds a DenseEmbedder for a Cohere-family Bedrock
// embedding model. dim is the requested output dimensionality (Cohere
// supports 256 / 512 / 1024 / 1536); 0 means model default.
func NewDenseEmbedder(client Client, model string, dim int) *DenseEmbedder {
	return &DenseEmbedder{
		client: client,
		model:  model,
		dim:    dim,
	}
}

// EmbedText splits inputs into batches of 96, calls the Bedrock client
// concurrently per batch, optionally L2-normalizes, and returns embeddings
// 1:1 with input.Texts.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}
	inputType := cohereInputType(input.Task)

	results, err := embedder.BatchProcess(ctx, input.Texts, batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
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

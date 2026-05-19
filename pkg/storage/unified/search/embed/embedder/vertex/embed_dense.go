package vertex

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// DefaultBatchSize is the per-call text count used when no override is
// configured. Vertex's hard ceiling is 250 instances per predict call,
// but the practical limit is per-call token budget — 50 is a safe default
// that stays well under typical token caps for the inputs we embed.
const DefaultBatchSize = 50

// callTimeout is the per-RPC deadline. Retries/hedging belong above this
// layer; this is just a hang-prevention ceiling.
const callTimeout = 30 * time.Second

// DenseEmbedder embeds text via Vertex AI's predict endpoint and returns
// dense float32 vectors.
type DenseEmbedder struct {
	client    Client
	model     string
	dim       int
	batchSize int
}

var _ embedder.TextEmbedder = (*DenseEmbedder)(nil)

// NewDenseEmbedder builds a DenseEmbedder. dim is the requested output
// dimensionality (passed as `outputDimensionality` to Vertex); 0 means
// "use the model default." batchSize caps the texts per Vertex call; 0
// falls back to DefaultBatchSize. Lower it when inputs are long enough
// that the provider-max would blow past per-call token limits.
func NewDenseEmbedder(client Client, model string, dim, batchSize int) *DenseEmbedder {
	if batchSize <= 0 {
		batchSize = DefaultBatchSize
	}
	return &DenseEmbedder{
		client:    client,
		model:     model,
		dim:       dim,
		batchSize: batchSize,
	}
}

// EmbedText splits inputs into batches sized to e.batchSize, calls the
// Vertex client concurrently per batch, optionally L2-normalizes, and
// returns embeddings 1:1 with input.Texts.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}
	taskType := vertexTaskType(input.Task)

	results, err := embedder.BatchProcess(ctx, input.Texts, e.batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
		callCtx, cancel := context.WithTimeoutCause(ctx, callTimeout, ErrCallTimeout)
		defer cancel()

		res, err := e.client.PredictEmbeddings(callCtx, e.model, texts, e.dim, taskType)
		if err != nil {
			if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
				return nil, ErrCallTimeout
			}
			return nil, err
		}
		if len(res.Vectors) != len(texts) {
			return nil, fmt.Errorf("vertex: got %d vectors for %d inputs", len(res.Vectors), len(texts))
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

// vertexTaskType maps generic task names to Vertex's task_type values.
// See https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/task-types
func vertexTaskType(t embedder.Task) string {
	switch t {
	case embedder.TaskRetrievalQuery:
		return "RETRIEVAL_QUERY"
	case embedder.TaskRetrievalDocument:
		return "RETRIEVAL_DOCUMENT"
	default:
		return "RETRIEVAL_DOCUMENT"
	}
}

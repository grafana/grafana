package vertex

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

const callTimeout = 30 * time.Second

// DenseEmbedder embeds text via Vertex AI's predict endpoint and returns
// dense float32 vectors.
type DenseEmbedder struct {
	client    Client
	model     string
	dim       int
	batchSize int
	hedger    *embedder.QueryHedger
}

var _ embedder.TextEmbedder = (*DenseEmbedder)(nil)

func NewDenseEmbedder(client Client, model string, dim, batchSize int, hedger ...*embedder.QueryHedger) *DenseEmbedder {
	e := &DenseEmbedder{
		client:    client,
		model:     model,
		dim:       dim,
		batchSize: batchSize,
	}
	if len(hedger) > 0 {
		e.hedger = hedger[0]
	}
	return e
}

// EmbedText splits inputs into batches sized to e.batchSize, calls the
// Vertex client concurrently per batch, optionally L2-normalizes, and
// returns embeddings 1:1 with input.Texts.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}
	taskType := vertexTaskType(input.Task)

	// Chunks run concurrently; accumulate tokens atomically.
	var tokens atomic.Int64
	results, err := embedder.BatchProcess(ctx, input.Texts, e.batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
		callCtx, cancel := context.WithTimeoutCause(ctx, callTimeout, ErrCallTimeout)
		defer cancel()
		if e.hedger == nil {
			res, err := e.client.PredictEmbeddings(callCtx, e.model, texts, e.dim, taskType)
			if err != nil {
				if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
					return nil, &embedder.RetryableError{Err: ErrCallTimeout}
				}
				return nil, err
			}
			if len(res.Vectors) != len(texts) {
				return nil, fmt.Errorf("vertex: got %d vectors for %d inputs", len(res.Vectors), len(texts))
			}
			tokens.Add(int64(res.InputTokens))
			if input.Normalize {
				embedder.NormalizeDenseBatch(res.Vectors)
			}
			out := make([]embedder.Embedding, len(res.Vectors))
			for i, v := range res.Vectors {
				out[i] = embedder.Embedding{Dense: v}
			}
			return out, nil
		}

		attempt := func(ctx context.Context, kind embedder.QueryAttemptKind) (embedder.EmbedTextOutput, error) {
			res, err := e.client.PredictEmbeddings(e.hedger.WithEligibleQueryAttempt(ctx, input, kind), e.model, texts, e.dim, taskType)
			if err != nil {
				var countErr *vectorCountError
				if !errors.As(err, &countErr) {
					return embedder.EmbedTextOutput{InputTokens: res.InputTokens}, err
				}
			}
			out := make([]embedder.Embedding, len(res.Vectors))
			for i, v := range res.Vectors {
				out[i] = embedder.Embedding{Dense: v}
			}
			return embedder.EmbedTextOutput{Embeddings: out, InputTokens: res.InputTokens}, nil
		}
		out, err := e.hedger.Run(callCtx, input, "vertex", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			return attempt(ctx, embedder.QueryAttemptOriginal)
		}, func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			return attempt(ctx, embedder.QueryAttemptExtra)
		}, func(err error) embedder.QueryAttemptOutcome {
			if status.Code(err) == codes.ResourceExhausted {
				return embedder.QueryAttemptQuota
			}
			return embedder.QueryAttemptError
		})
		tokens.Add(int64(out.InputTokens))
		if err != nil {
			if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
				return nil, &embedder.RetryableError{Err: ErrCallTimeout}
			}
			return nil, err
		}
		if input.Normalize {
			for i := range out.Embeddings {
				embedder.NormalizeDenseInPlace(out.Embeddings[i].Dense)
			}
		}
		return out.Embeddings, nil
	})
	if err != nil {
		// Successful chunks were still billed; surface their tokens with the error.
		return embedder.EmbedTextOutput{InputTokens: int(tokens.Load())}, err
	}
	return embedder.EmbedTextOutput{Embeddings: results, InputTokens: int(tokens.Load())}, nil
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

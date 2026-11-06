package azure

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/openai/openai-go/v3"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

const callTimeout = 30 * time.Second

// DenseEmbedder embeds text via the Azure OpenAI embeddings API and returns
// dense float32 vectors.
type DenseEmbedder struct {
	client    Client
	dim       int
	batchSize int
	hedger    *embedder.QueryHedger
}

var _ embedder.TextEmbedder = (*DenseEmbedder)(nil)

// NewDenseEmbedder builds a DenseEmbedder. dim is the requested output
// dimensionality (0 = the deployment's native size); batchSize is the number
// of texts per embeddings call.
func NewDenseEmbedder(client Client, dim, batchSize int, hedger ...*embedder.QueryHedger) *DenseEmbedder {
	e := &DenseEmbedder{
		client:    client,
		dim:       dim,
		batchSize: batchSize,
	}
	if len(hedger) > 0 {
		e.hedger = hedger[0]
	}
	return e
}

// EmbedText splits inputs into batches sized to e.batchSize, calls the Azure
// OpenAI client per batch, optionally L2-normalizes, and returns embeddings
// 1:1 with input.Texts. Azure OpenAI embeddings are symmetric, so the Task
// hint (query vs document) is not used.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}

	// Chunks run concurrently; accumulate tokens atomically.
	var tokens atomic.Int64
	results, err := embedder.BatchProcess(ctx, input.Texts, e.batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
		callCtx, cancel := context.WithTimeoutCause(ctx, callTimeout, ErrCallTimeout)
		defer cancel()
		if e.hedger == nil {
			res, err := e.client.EmbedTexts(callCtx, texts, e.dim)
			if err != nil {
				if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
					return nil, &embedder.RetryableError{Err: ErrCallTimeout}
				}
				return nil, err
			}
			if len(res.Vectors) != len(texts) {
				return nil, fmt.Errorf("azure: got %d vectors for %d inputs", len(res.Vectors), len(texts))
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

		attempt := func(ctx context.Context, extra bool) (embedder.EmbedTextOutput, error) {
			var res EmbedResult
			var err error
			if extra {
				client, ok := e.client.(interface {
					EmbedTextsHedge(context.Context, []string, int) (EmbedResult, error)
				})
				if !ok {
					return embedder.EmbedTextOutput{}, fmt.Errorf("azure: client does not support a single-request query hedge")
				}
				res, err = client.EmbedTextsHedge(e.hedger.WithEligibleQueryAttempt(ctx, input, embedder.QueryAttemptExtra), texts, e.dim)
			} else {
				res, err = e.client.EmbedTexts(e.hedger.WithEligibleQueryAttempt(ctx, input, embedder.QueryAttemptOriginal), texts, e.dim)
			}
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
		out, err := e.hedger.Run(callCtx, input, "azure", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			return attempt(ctx, false)
		}, func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			return attempt(ctx, true)
		}, func(err error) embedder.QueryAttemptOutcome {
			if apiErr, ok := errors.AsType[*openai.Error](err); ok && apiErr.StatusCode == http.StatusTooManyRequests {
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

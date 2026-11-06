package bedrock

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"

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
// Bedrock client concurrently per batch, optionally L2-normalizes, and
// returns embeddings 1:1 with input.Texts.
func (e *DenseEmbedder) EmbedText(ctx context.Context, input embedder.EmbedTextInput) (embedder.EmbedTextOutput, error) {
	if len(input.Texts) == 0 {
		return embedder.EmbedTextOutput{}, nil
	}
	inputType := cohereInputType(input.Task)

	// Chunks run concurrently; accumulate tokens atomically.
	var tokens atomic.Int64
	results, err := embedder.BatchProcess(ctx, input.Texts, e.batchSize, func(ctx context.Context, texts []string) ([]embedder.Embedding, error) {
		callCtx, cancel := context.WithTimeoutCause(ctx, callTimeout, ErrCallTimeout)
		defer cancel()
		if e.hedger == nil {
			res, err := e.client.EmbedTexts(callCtx, e.model, texts, inputType, e.dim)
			if err != nil {
				if errors.Is(context.Cause(callCtx), ErrCallTimeout) {
					return nil, &embedder.RetryableError{Err: ErrCallTimeout}
				}
				return nil, err
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
					EmbedTextsHedge(context.Context, string, []string, string, int) (EmbedResult, error)
				})
				if !ok {
					return embedder.EmbedTextOutput{}, fmt.Errorf("bedrock: client does not support a single-request query hedge")
				}
				res, err = client.EmbedTextsHedge(e.hedger.WithEligibleQueryAttempt(ctx, input, embedder.QueryAttemptExtra), e.model, texts, inputType, e.dim)
			} else {
				res, err = e.client.EmbedTexts(e.hedger.WithEligibleQueryAttempt(ctx, input, embedder.QueryAttemptOriginal), e.model, texts, inputType, e.dim)
			}
			if err != nil {
				return embedder.EmbedTextOutput{}, err
			}
			out := make([]embedder.Embedding, len(res.Vectors))
			for i, v := range res.Vectors {
				out[i] = embedder.Embedding{Dense: v}
			}
			return embedder.EmbedTextOutput{Embeddings: out, InputTokens: res.InputTokens}, nil
		}
		out, err := e.hedger.Run(callCtx, input, "bedrock", func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			return attempt(ctx, false)
		}, func(ctx context.Context) (embedder.EmbedTextOutput, error) {
			return attempt(ctx, true)
		}, func(err error) embedder.QueryAttemptOutcome {
			if _, ok := errors.AsType[*types.ThrottlingException](err); ok {
				return embedder.QueryAttemptQuota
			}
			if _, ok := errors.AsType[*types.ServiceQuotaExceededException](err); ok {
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

package bedrock

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

// maxDocsPerCall is Cohere Rerank's per-request document cap on Bedrock.
// The HybridSearch pipeline truncates its scored pool to 200, so a single
// call always suffices — exceeding this is a caller bug, not a batching need.
const maxDocsPerCall = 1000

// Reranker scores documents against a query via Cohere Rerank on Bedrock.
type Reranker struct {
	client      Client
	model       string
	callTimeout time.Duration
}

var _ rerank.Scorer = (*Reranker)(nil)

func NewReranker(client Client, model string) *Reranker {
	return &Reranker{client: client, model: model, callTimeout: 5 * time.Second}
}

// Score returns scores 1:1 with texts. Indices the API omits default to 0.
func (r *Reranker) Score(ctx context.Context, query string, texts []string) ([]float64, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	if len(texts) > maxDocsPerCall {
		return nil, fmt.Errorf("bedrock rerank: %d documents exceeds the %d docs/request cap", len(texts), maxDocsPerCall)
	}
	callCtx, cancel := context.WithTimeoutCause(ctx, r.callTimeout, rerank.ErrCallTimeout)
	defer cancel()

	results, err := r.client.Rerank(callCtx, r.model, query, texts)
	if err != nil {
		if errors.Is(context.Cause(callCtx), rerank.ErrCallTimeout) {
			return nil, rerank.ErrCallTimeout
		}
		return nil, err
	}
	scores := make([]float64, len(texts))
	for _, res := range results {
		if res.Index >= 0 && res.Index < len(scores) {
			scores[res.Index] = res.Score
		}
	}
	return scores, nil
}

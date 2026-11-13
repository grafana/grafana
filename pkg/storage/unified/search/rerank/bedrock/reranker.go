package bedrock

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

// maxDocsPerCall is Cohere Rerank's per-request document cap on Bedrock.
const maxDocsPerCall = 1000

// Reranker scores documents against a query via Cohere Rerank on Bedrock.
type Reranker struct {
	client      Client
	model       string
	callTimeout time.Duration
	hedgeDelay  time.Duration
}

var _ rerank.Scorer = (*Reranker)(nil)

func NewReranker(client Client, model string) *Reranker {
	return NewRerankerWithHedgeDelay(client, model, rerank.DefaultHedgeDelay)
}

// NewRerankerWithHedgeDelay uses delay between attempts; nonpositive values disable hedging.
func NewRerankerWithHedgeDelay(client Client, model string, delay time.Duration) *Reranker {
	return &Reranker{client: client, model: model, callTimeout: 5 * time.Second, hedgeDelay: delay}
}

// Score returns scores 1:1 with texts. Every input must have a provider result;
// out-of-range indices are ignored and an incomplete response fails the attempt.
func (r *Reranker) Score(ctx context.Context, query string, texts []string) ([]float64, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	if len(texts) > maxDocsPerCall {
		return nil, fmt.Errorf("bedrock rerank: %d documents exceeds the %d docs/request cap", len(texts), maxDocsPerCall)
	}
	callCtx, cancel := context.WithTimeoutCause(ctx, r.callTimeout, rerank.ErrCallTimeout)
	defer cancel()

	return rerank.HedgeScores(callCtx, len(texts), r.hedgeDelay, func(attemptCtx context.Context) ([]float64, error) {
		results, err := r.client.Rerank(attemptCtx, r.model, query, texts)
		if err != nil {
			return nil, err
		}
		scores := make([]float64, len(texts))
		seen := make([]bool, len(texts))
		for _, res := range results {
			if res.Index >= 0 && res.Index < len(scores) {
				scores[res.Index] = res.Score
				seen[res.Index] = true
			}
		}
		for i, present := range seen {
			if !present {
				return nil, fmt.Errorf("bedrock rerank: missing score for input %d", i)
			}
		}
		return scores, nil
	})
}

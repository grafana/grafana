package vertex

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

// maxRecordsPerCall is the Ranking API's documented per-request record cap.
const maxRecordsPerCall = 1000

// Reranker scores texts against a query via the Ranking API.
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

// Score returns scores 1:1 with texts. Every input must have a provider record;
// unknown record IDs are ignored and an incomplete response fails the attempt.
func (r *Reranker) Score(ctx context.Context, query string, texts []string) ([]float64, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	if len(texts) > maxRecordsPerCall {
		return nil, fmt.Errorf("vertex rerank: %d texts exceeds the %d records/request cap", len(texts), maxRecordsPerCall)
	}
	callCtx, cancel := context.WithTimeoutCause(ctx, r.callTimeout, rerank.ErrCallTimeout)
	defer cancel()

	return rerank.HedgeScores(callCtx, len(texts), r.hedgeDelay, func(attemptCtx context.Context) ([]float64, error) {
		recs, err := r.client.Rank(attemptCtx, r.model, query, texts)
		if err != nil {
			return nil, err
		}
		scores := make([]float64, len(texts))
		seen := make([]bool, len(texts))
		for _, rec := range recs {
			if i, convErr := strconv.Atoi(rec.ID); convErr == nil && i >= 0 && i < len(scores) {
				scores[i] = rec.Score
				seen[i] = true
			}
		}
		for i, present := range seen {
			if !present {
				return nil, fmt.Errorf("vertex rerank: missing score for input %d", i)
			}
		}
		return scores, nil
	})
}

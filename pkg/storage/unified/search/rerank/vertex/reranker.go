package vertex

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

// maxRecordsPerCall is the Ranking API's documented per-request record cap.
// HybridSearch's fused pool is capped at 200 resources, so a single call
// always suffices — exceeding this is a caller bug, not a batching need.
const maxRecordsPerCall = 200

// Reranker scores texts against a query via the Ranking API.
type Reranker struct {
	client      Client
	model       string
	callTimeout time.Duration
}

var _ rerank.Scorer = (*Reranker)(nil)

func NewReranker(client Client, model string) *Reranker {
	return &Reranker{client: client, model: model, callTimeout: 5 * time.Second}
}

// Score returns scores 1:1 with texts. Records the API omits (it should
// return all with TopN=len) default to 0.
func (r *Reranker) Score(ctx context.Context, query string, texts []string) ([]float64, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	if len(texts) > maxRecordsPerCall {
		return nil, fmt.Errorf("vertex rerank: %d texts exceeds the %d records/request cap", len(texts), maxRecordsPerCall)
	}
	callCtx, cancel := context.WithTimeoutCause(ctx, r.callTimeout, rerank.ErrCallTimeout)
	defer cancel()

	recs, err := r.client.Rank(callCtx, r.model, query, texts)
	if err != nil {
		if errors.Is(context.Cause(callCtx), rerank.ErrCallTimeout) {
			return nil, rerank.ErrCallTimeout
		}
		return nil, err
	}
	scores := make([]float64, len(texts))
	for _, rec := range recs {
		if i, convErr := strconv.Atoi(rec.ID); convErr == nil && i >= 0 && i < len(scores) {
			scores[i] = rec.Score
		}
	}
	return scores, nil
}

package bedrock

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"

	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
)

// rerankRequest is Cohere Rerank's InvokeModel body (api_version 2 is the
// Rerank 3.x contract).
type rerankRequest struct {
	APIVersion int      `json:"api_version"`
	Query      string   `json:"query"`
	Documents  []string `json:"documents"`
}

type rerankResponse struct {
	Results []RerankResult `json:"results"`
}

// invokeClient is the production Client backed by bedrockruntime. Auth and
// region come from the aws.Config it was built with (default chain).
type invokeClient struct {
	runtime *bedrockruntime.Client
}

func NewClient(rt *bedrockruntime.Client) Client {
	return &invokeClient{runtime: rt}
}

func (c *invokeClient) Rerank(ctx context.Context, model, query string, documents []string) ([]RerankResult, error) {
	body, err := json.Marshal(rerankRequest{
		APIVersion: 2,
		Query:      query,
		Documents:  documents,
	})
	if err != nil {
		return nil, fmt.Errorf("bedrock rerank: marshal request: %w", err)
	}
	out, err := c.runtime.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(model),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        body,
	}, func(o *bedrockruntime.Options) {
		// Keep each hedged operation to one SDK attempt without changing the shared client.
		o.RetryMaxAttempts = 1
	})
	if err != nil {
		var statusErr interface{ HTTPStatusCode() int }
		throttled := retry.IsErrorThrottles(retry.DefaultThrottles).IsErrorThrottle(err).Bool() ||
			(errors.As(err, &statusErr) && statusErr.HTTPStatusCode() == http.StatusTooManyRequests)
		if ctx.Err() == nil && !throttled && c.runtime.Options().Retryer.IsErrorRetryable(err) {
			err = rerank.MarkRetryable(err)
		}
		return nil, fmt.Errorf("bedrock rerank: invoke: %w", err)
	}
	var resp rerankResponse
	if err := json.Unmarshal(out.Body, &resp); err != nil {
		return nil, fmt.Errorf("bedrock rerank: unmarshal response: %w", err)
	}
	return resp.Results, nil
}

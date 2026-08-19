// Package bedrock implements a rerank.Scorer backed by Cohere Rerank on
// AWS Bedrock, called through InvokeModel (not bedrock-agent-runtime) so
// the existing bedrock:InvokeModel IAM grants cover it.
package bedrock

import "context"

// RerankResult is one document's score, keyed by its input index.
type RerankResult struct {
	Index int     `json:"index"`
	Score float64 `json:"relevance_score"`
}

// Client is the SDK-facing dependency of Reranker. The real implementation
// in client.go wraps bedrockruntime; tests supply a fake.
type Client interface {
	Rerank(ctx context.Context, model, query string, documents []string) ([]RerankResult, error)
}

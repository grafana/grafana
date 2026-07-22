// Package vertex implements a rerank.Scorer backed by the Vertex AI
// Ranking API (Discovery Engine).
package vertex

import "context"

// RecordScore is one ranked record's score, keyed by the record id the
// client assigned (the input index as a decimal string).
type RecordScore struct {
	ID    string
	Score float64
}

// Client is the SDK-facing dependency of Reranker. The real implementation
// in client.go wraps cloud.google.com/go/discoveryengine; tests supply a fake.
type Client interface {
	Rank(ctx context.Context, model, query string, texts []string) ([]RecordScore, error)
}

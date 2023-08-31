package embedding

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type EmbeddingEngineType string

const (
	EmbeddingEngineOpenAI EmbeddingEngineType = "openai"
)

// Client is a client for interacting with an embedding engine.
type Client interface {
	Embeddings(ctx context.Context, text string) ([]float32, error)
}

// NewClient creates a new embedding engine client.
func NewClient(cfg setting.EmbeddingEngineSettings) Client {
	// TODO: dispatch based on cfg.Type.
	return nil
}

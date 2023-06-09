package client

import (
	"context"
)

type LLMClient interface {
	Embeddings(ctx context.Context, payload string) ([]float32, error)
}

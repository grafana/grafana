package store

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

// Client is a client for interacting with a vector store.
type Client interface {
	Collections(ctx context.Context) ([]string, error)
	CollectionExists(ctx context.Context, collection string) (bool, error)
	CreateCollection(ctx context.Context, collection string, size uint64) error
	PointExists(ctx context.Context, collection string, id uint64) (bool, error)
	UpsertColumnar(ctx context.Context, collection string, ids []uint64, embeddings [][]float32, payloadJSONs []string) error
	Search(ctx context.Context, collection string, vector []float32, limit uint64) ([]string, error)
}

// NewClient creates a new vector store client.
func NewClient(cfg setting.VectorStoreSettings) (Client, context.CancelFunc, error) {
	// TODO: dispatch based on cfg.Type.
	return nil, nil, nil
}

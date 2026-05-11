package backfill

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// ProvideVectorBackfiller constructs the embedding backfiller. Returns
// (nil, nil) when the feature is disabled or any required dep is missing.
// Callers must tolerate a nil result and treat it as "feature off".
func ProvideVectorBackfiller(
	cfg *setting.Cfg,
	storage resource.StorageBackend,
	vb vector.VectorBackend,
	emb *embedder.Embedder,
) (*VectorBackfiller, error) {
	if cfg == nil || !cfg.VectorBackfillerEnabled {
		return nil, nil
	}
	if cfg.EmbeddingProvider == "" {
		return nil, nil
	}
	if storage == nil || vb == nil || emb == nil {
		return nil, nil
	}
	return NewVectorBackfiller(Options{
		Storage:       storage,
		VectorBackend: vb,
		Embedder:      emb,
		BatchEmbedder: embedder.NewBatchEmbedder(*emb),
		Builders:      []embed.Builder{dashboard.New()},
		Log:           log.New("backfill"),
	})
}

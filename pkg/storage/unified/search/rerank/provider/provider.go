// Package provider wires the configured reranker for the unified storage
// search server. It lives in its own sub-package so it can import both the
// parent rerank types and the per-provider sub-packages without an import
// cycle (mirrors search/embed/embedder/provider).
package provider

import (
	"context"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank/bedrock"
	"github.com/grafana/grafana/pkg/storage/unified/search/rerank/vertex"
)

// ProvideReranker constructs the configured reranker, or returns (nil, nil)
// when no provider is configured. Callers (the search server) treat nil as
// "reranking disabled": HybridSearch returns RRF ordering and min_relevance
// is a no-op.
//
// vectorMetrics is optional; when non-nil its RerankDuration histogram is
// wired in so each provider call is timed.
func ProvideReranker(cfg *setting.Cfg, vectorMetrics *resource.VectorMetrics) (*rerank.Reranker, error) {
	var hist *prometheus.HistogramVec
	if vectorMetrics != nil {
		hist = vectorMetrics.RerankDuration
	}
	switch cfg.RerankProvider {
	case "":
		return nil, nil
	case "vertex":
		return newVertexReranker(cfg, hist)
	case "bedrock":
		return newBedrockReranker(cfg, hist)
	default:
		return nil, fmt.Errorf("unknown rerank provider %q (expected vertex, bedrock, or empty)", cfg.RerankProvider)
	}
}

func newVertexReranker(cfg *setting.Cfg, duration *prometheus.HistogramVec) (*rerank.Reranker, error) {
	if cfg.RerankVertexProjectID == "" {
		return nil, fmt.Errorf("vector_reranker.provider=vertex requires vertex_project_id")
	}
	client, err := vertex.NewClient(context.Background(), cfg.RerankVertexProjectID, cfg.RerankVertexLocation)
	if err != nil {
		return nil, fmt.Errorf("vertex rank client: %w", err)
	}
	model := "vertex/" + cfg.RerankVertexModel
	scorer := vertex.NewReranker(client, cfg.RerankVertexModel)
	return &rerank.Reranker{
		Scorer:     rerank.Instrument(scorer, model, duration),
		Model:      model,
		Thresholds: rerank.ThresholdsForModel(model),
	}, nil
}

func newBedrockReranker(cfg *setting.Cfg, duration *prometheus.HistogramVec) (*rerank.Reranker, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.RerankBedrockRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("aws config: %w", err)
	}
	rt := bedrockruntime.NewFromConfig(awsCfg)
	model := "bedrock/" + cfg.RerankBedrockModel
	scorer := bedrock.NewReranker(bedrock.NewClient(rt), cfg.RerankBedrockModel)
	return &rerank.Reranker{
		Scorer:     rerank.Instrument(scorer, model, duration),
		Model:      model,
		Thresholds: rerank.ThresholdsForModel(model),
	}, nil
}

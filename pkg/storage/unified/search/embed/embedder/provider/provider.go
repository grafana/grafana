// Package provider wires the configured embedder for the unified storage
// search server. It lives in its own sub-package so it can import both the
// parent embedder types and the per-provider sub-packages without an import
// cycle.
package provider

import (
	"context"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/bedrock"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/vertex"
)

// ProvideEmbedder constructs the configured embedder, or returns (nil, nil)
// when no provider is configured. Callers (the search server) treat nil as
// "vector search is disabled" and surface Unimplemented to clients.
//
// The configured provider's connection fields (project ID for Vertex, region
// + credentials for Bedrock) must be present when the provider is set;
// missing required fields return an error so misconfiguration fails at
// startup, not at first request.
func ProvideEmbedder(cfg *setting.Cfg) (*embedder.Embedder, error) {
	switch cfg.EmbeddingProvider {
	case "":
		return nil, nil
	case "vertex":
		return newVertexEmbedder(cfg)
	case "bedrock":
		return newBedrockEmbedder(cfg)
	default:
		return nil, fmt.Errorf("unknown embedding provider %q (expected vertex, bedrock, or empty)", cfg.EmbeddingProvider)
	}
}

func newVertexEmbedder(cfg *setting.Cfg) (*embedder.Embedder, error) {
	if cfg.VertexProjectID == "" {
		return nil, fmt.Errorf("vector_embedder.provider=vertex requires vertex_project_id")
	}
	client, err := vertex.NewClient(context.Background(), cfg.VertexProjectID, cfg.VertexLocation)
	if err != nil {
		return nil, fmt.Errorf("vertex client: %w", err)
	}
	dense := vertex.NewDenseEmbedder(client, cfg.VertexModel, cfg.VertexDimensions)
	return &embedder.Embedder{
		TextEmbedder: dense,
		Model:        "vertex/" + cfg.VertexModel,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.VertexDimensions),
		Normalized:   false, // Vertex returns un-normalized vectors
	}, nil
}

func newBedrockEmbedder(cfg *setting.Cfg) (*embedder.Embedder, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.BedrockRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("aws config: %w", err)
	}
	rt := bedrockruntime.NewFromConfig(awsCfg)
	client := bedrock.NewClient(rt)
	dense := bedrock.NewDenseEmbedder(client, cfg.BedrockModel, cfg.BedrockDimensions)
	return &embedder.Embedder{
		TextEmbedder: dense,
		Model:        "bedrock/" + cfg.BedrockModel,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.BedrockDimensions),
		Normalized:   false, // Cohere on Bedrock returns un-normalized vectors
	}, nil
}

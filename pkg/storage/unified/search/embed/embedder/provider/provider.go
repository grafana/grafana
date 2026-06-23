// Package provider wires the configured embedder for the unified storage
// search server. It lives in its own sub-package so it can import both the
// parent embedder types and the per-provider sub-packages without an import
// cycle.
package provider

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/azure"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/bedrock"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/vertex"
)

// ProvideEmbedder constructs the configured embedder, or returns (nil, nil)
// when no provider is configured. Callers (the search server) treat nil as
// "vector search is disabled" and surface Unimplemented to clients.
//
// vectorMetrics is optional; when non-nil its EmbedDuration histogram is
// wired into the constructed Embedder so each provider call is timed.
//
// The configured provider's connection fields (project ID for Vertex, region
// + credentials for Bedrock, endpoint + AZURE_OPENAI_API_KEY for Azure) must
// be present when the provider is set; missing required fields return an error
// so misconfiguration fails at startup, not at first request.
func ProvideEmbedder(cfg *setting.Cfg, vectorMetrics *resource.VectorMetrics) (*embedder.Embedder, error) {
	var hist *prometheus.HistogramVec
	if vectorMetrics != nil {
		hist = vectorMetrics.EmbedDuration
	}
	switch cfg.EmbeddingProvider {
	case "":
		return nil, nil
	case "vertex":
		return newVertexEmbedder(cfg, hist)
	case "bedrock":
		return newBedrockEmbedder(cfg, hist)
	case "azure":
		return newAzureEmbedder(cfg, hist)
	default:
		return nil, fmt.Errorf("unknown embedding provider %q (expected vertex, bedrock, azure, or empty)", cfg.EmbeddingProvider)
	}
}

func newVertexEmbedder(cfg *setting.Cfg, duration *prometheus.HistogramVec) (*embedder.Embedder, error) {
	if cfg.VertexProjectID == "" {
		return nil, fmt.Errorf("vector_embedder.provider=vertex requires vertex_project_id")
	}
	client, err := vertex.NewClient(context.Background(), cfg.VertexProjectID, cfg.VertexLocation)
	if err != nil {
		return nil, fmt.Errorf("vertex client: %w", err)
	}
	model := "vertex/" + cfg.VertexModel
	dense := vertex.NewDenseEmbedder(client, cfg.VertexModel, cfg.VertexDimensions, cfg.VertexBatchSize)
	return &embedder.Embedder{
		TextEmbedder: embedder.Instrument(dense, model, duration),
		Model:        model,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.VertexDimensions),
		Normalized:   false, // Vertex returns un-normalized vectors
	}, nil
}

func newBedrockEmbedder(cfg *setting.Cfg, duration *prometheus.HistogramVec) (*embedder.Embedder, error) {
	// Adaptive retry adds a client-side rate limiter that backs off request
	// issuance when Bedrock returns ThrottlingException (429), which the
	// default standard retryer does not; combined with a higher attempt
	// ceiling it lets transient token-quota throttling recover instead of
	// failing the embed at the default 3 attempts.
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.BedrockRegion),
		awsconfig.WithRetryMode(aws.RetryModeAdaptive),
		awsconfig.WithRetryMaxAttempts(cfg.BedrockMaxAttempts),
	)
	if err != nil {
		return nil, fmt.Errorf("aws config: %w", err)
	}
	rt := bedrockruntime.NewFromConfig(awsCfg)
	client := bedrock.NewClient(rt)
	model := "bedrock/" + cfg.BedrockModel
	dense := bedrock.NewDenseEmbedder(client, cfg.BedrockModel, cfg.BedrockDimensions, cfg.BedrockBatchSize)
	return &embedder.Embedder{
		TextEmbedder: embedder.Instrument(dense, model, duration),
		Model:        model,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.BedrockDimensions),
		Normalized:   false, // Cohere on Bedrock returns un-normalized vectors
	}, nil
}

func newAzureEmbedder(cfg *setting.Cfg, duration *prometheus.HistogramVec) (*embedder.Embedder, error) {
	if cfg.AzureEndpoint == "" {
		return nil, fmt.Errorf("vector_embedder.provider=azure requires azure_endpoint")
	}
	apiKey := os.Getenv("AZURE_OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("vector_embedder.provider=azure requires the AZURE_OPENAI_API_KEY env var")
	}
	client, err := azure.NewClient(cfg.AzureEndpoint, cfg.AzureDeployment, cfg.AzureAPIVersion, apiKey)
	if err != nil {
		return nil, fmt.Errorf("azure client: %w", err)
	}
	model := "azure/" + cfg.AzureDeployment
	dense := azure.NewDenseEmbedder(client, cfg.AzureDimensions, cfg.AzureBatchSize)
	return &embedder.Embedder{
		TextEmbedder: embedder.Instrument(dense, model, duration),
		Model:        model,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.AzureDimensions),
		Normalized:   false, // Azure OpenAI vectors aren't guaranteed unit-norm after dimension reduction
	}, nil
}

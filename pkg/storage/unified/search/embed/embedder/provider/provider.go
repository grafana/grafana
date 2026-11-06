// Package provider wires the configured embedder for the unified storage
// search server. It lives in its own sub-package so it can import both the
// parent embedder types and the per-provider sub-packages without an import
// cycle.
package provider

import (
	"context"
	"fmt"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
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
// Provider calls are timed and their input tokens tallied. Nil vectorMetrics
// means unregistered metrics, for callers without a registry.
//
// The configured provider's connection fields (project ID for Vertex, region
// + credentials for Bedrock, endpoint for Azure) must be present when the
// provider is set. Azure uses AZURE_OPENAI_API_KEY when set, otherwise the
// default Azure credential chain (including Workload Identity).
func ProvideEmbedder(cfg *setting.Cfg, vectorMetrics *resource.VectorMetrics) (*embedder.Embedder, error) {
	if err := cfg.ValidateQueryHedgeConfig(); err != nil {
		return nil, err
	}
	if vectorMetrics == nil {
		vectorMetrics = resource.ProvideVectorMetrics(nil)
	}
	hist := vectorMetrics.EmbedDuration
	tokensTotal := vectorMetrics.EmbedTokensTotal
	hedger, err := embedder.NewQueryHedger(cfg.QueryHedgeDelay, cfg.QueryHedgeMaxConcurrent, &queryHedgeMetrics{vectorMetrics})
	if err != nil {
		return nil, fmt.Errorf("query hedge: %w", err)
	}
	if cfg.QueryHedgeMaxConcurrent == 0 {
		hedger = nil
	}
	switch cfg.EmbeddingProvider {
	case "":
		return nil, nil
	case "vertex":
		return newVertexEmbedder(cfg, hist, tokensTotal, vectorMetrics.QueryEmbeddingTransportRequestsTotal, hedger)
	case "bedrock":
		return newBedrockEmbedder(cfg, hist, tokensTotal, vectorMetrics.QueryEmbeddingTransportRequestsTotal, hedger)
	case "azure":
		return newAzureEmbedder(cfg, hist, tokensTotal, vectorMetrics.QueryEmbeddingTransportRequestsTotal, hedger)
	default:
		return nil, fmt.Errorf("unknown embedding provider %q (expected vertex, bedrock, azure, or empty)", cfg.EmbeddingProvider)
	}
}

func newVertexEmbedder(cfg *setting.Cfg, duration *prometheus.HistogramVec, tokensTotal, transportRequests *prometheus.CounterVec, hedger *embedder.QueryHedger) (*embedder.Embedder, error) {
	if cfg.VertexProjectID == "" {
		return nil, fmt.Errorf("vector_embedder.provider=vertex requires vertex_project_id")
	}
	client, err := vertex.NewClientWithRequestObserver(context.Background(), cfg.VertexProjectID, cfg.VertexLocation, enabledRequestObserver(hedger, "vertex", transportRequests))
	if err != nil {
		return nil, fmt.Errorf("vertex client: %w", err)
	}
	model := "vertex/" + cfg.VertexModel
	dense := vertex.NewDenseEmbedder(client, cfg.VertexModel, cfg.VertexDimensions, cfg.VertexBatchSize, hedger)
	return &embedder.Embedder{
		TextEmbedder: embedder.Instrument(dense, model, duration, tokensTotal),
		Model:        model,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.VertexDimensions),
		Normalized:   false, // Vertex returns un-normalized vectors
	}, nil
}

func newBedrockEmbedder(cfg *setting.Cfg, duration *prometheus.HistogramVec, tokensTotal, transportRequests *prometheus.CounterVec, hedger *embedder.QueryHedger) (*embedder.Embedder, error) {
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
	if hedger != nil {
		client := awsCfg.HTTPClient
		if client == nil {
			client = awshttp.NewBuildableClient()
		}
		awsCfg.HTTPClient = &embedder.ObservedHTTPClient{Client: client, Observer: requestObserver("bedrock", transportRequests)}
	}
	rt := bedrockruntime.NewFromConfig(awsCfg)
	client := bedrock.NewClient(rt)
	model := "bedrock/" + cfg.BedrockModel
	dense := bedrock.NewDenseEmbedder(client, cfg.BedrockModel, cfg.BedrockDimensions, cfg.BedrockBatchSize, hedger)
	return &embedder.Embedder{
		TextEmbedder: embedder.Instrument(dense, model, duration, tokensTotal),
		Model:        model,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.BedrockDimensions),
		Normalized:   false, // Cohere on Bedrock returns un-normalized vectors
	}, nil
}

func newAzureEmbedder(cfg *setting.Cfg, duration *prometheus.HistogramVec, tokensTotal, transportRequests *prometheus.CounterVec, hedger *embedder.QueryHedger) (*embedder.Embedder, error) {
	if cfg.AzureEndpoint == "" {
		return nil, fmt.Errorf("vector_embedder.provider=azure requires azure_endpoint")
	}
	var client azure.Client
	var err error
	if apiKey := os.Getenv("AZURE_OPENAI_API_KEY"); apiKey != "" {
		client, err = azure.NewClient(cfg.AzureEndpoint, cfg.AzureDeployment, cfg.AzureAPIVersion, apiKey, enabledRequestObserver(hedger, "azure", transportRequests))
	} else {
		credential, credentialErr := azidentity.NewDefaultAzureCredential(nil)
		if credentialErr != nil {
			return nil, fmt.Errorf("azure credential: %w", credentialErr)
		}
		client, err = azure.NewClientWithTokenCredential(cfg.AzureEndpoint, cfg.AzureDeployment, cfg.AzureAPIVersion, credential, enabledRequestObserver(hedger, "azure", transportRequests))
	}
	if err != nil {
		return nil, fmt.Errorf("azure client: %w", err)
	}
	model := "azure/" + cfg.AzureDeployment
	dense := azure.NewDenseEmbedder(client, cfg.AzureDimensions, cfg.AzureBatchSize, hedger)
	return &embedder.Embedder{
		TextEmbedder: embedder.Instrument(dense, model, duration, tokensTotal),
		Model:        model,
		VectorType:   embedder.VectorTypeDense,
		Metric:       embedder.CosineDistance,
		Dimensions:   uint32(cfg.AzureDimensions),
		Normalized:   false, // Azure OpenAI vectors aren't guaranteed unit-norm after dimension reduction
	}, nil
}

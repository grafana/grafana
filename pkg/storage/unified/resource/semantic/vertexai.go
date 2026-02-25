package semantic

import (
	"context"
	"fmt"

	"google.golang.org/genai"
)

// VertexAIConfig holds configuration for the Vertex AI embedding provider.
type VertexAIConfig struct {
	// Model is the embedding model name (e.g. "text-embedding-005", "gemini-embedding-001").
	Model string
	// OutputDimensionality controls the size of the output vector.
	// For text-embedding-005 the max/default is 768.
	OutputDimensionality int32
}

type vertexAIProvider struct {
	client *genai.Client
	cfg    VertexAIConfig
}

// NewVertexAIProvider creates an EmbeddingProvider backed by Vertex AI.
//
// Authentication is handled via environment variables:
//
//	GOOGLE_CLOUD_PROJECT   – GCP project ID
//	GOOGLE_CLOUD_LOCATION  – e.g. "us-central1" or "global"
//	GOOGLE_GENAI_USE_VERTEXAI=True
//
// Or through Application Default Credentials (ADC).
func NewVertexAIProvider(ctx context.Context, cfg VertexAIConfig) (EmbeddingProvider, error) {
	if cfg.Model == "" {
		cfg.Model = "text-embedding-005"
	}
	if cfg.OutputDimensionality == 0 {
		cfg.OutputDimensionality = 768
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		HTTPOptions: genai.HTTPOptions{APIVersion: "v1"},
	})
	if err != nil {
		return nil, fmt.Errorf("creating genai client: %w", err)
	}

	return &vertexAIProvider{
		client: client,
		cfg:    cfg,
	}, nil
}

func (v *vertexAIProvider) Dimensions() int {
	return int(v.cfg.OutputDimensionality)
}

func (v *vertexAIProvider) EmbedTexts(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	// Vertex AI limits each request to 250 texts / 20k tokens.
	// For now we send them all in one call; batching can be added later.
	const maxBatch = 250
	if len(texts) > maxBatch {
		return v.embedBatched(ctx, texts, maxBatch)
	}

	return v.embedBatch(ctx, texts)
}

func (v *vertexAIProvider) embedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	contents := make([]*genai.Content, len(texts))
	for i, t := range texts {
		contents[i] = &genai.Content{
			Parts: []*genai.Part{{Text: t}},
			Role:  genai.RoleUser,
		}
	}

	dim := v.cfg.OutputDimensionality
	resp, err := v.client.Models.EmbedContent(ctx, v.cfg.Model,
		contents,
		&genai.EmbedContentConfig{
			OutputDimensionality: &dim,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("vertex AI embed call: %w", err)
	}

	if resp == nil || resp.Embeddings == nil {
		return nil, fmt.Errorf("vertex AI returned nil embeddings")
	}

	if len(resp.Embeddings) != len(texts) {
		return nil, fmt.Errorf("vertex AI returned %d embeddings for %d texts", len(resp.Embeddings), len(texts))
	}

	result := make([][]float32, len(resp.Embeddings))
	for i, emb := range resp.Embeddings {
		result[i] = emb.Values
	}
	return result, nil
}

// embedBatched splits texts into chunks of batchSize and concatenates results.
func (v *vertexAIProvider) embedBatched(ctx context.Context, texts []string, batchSize int) ([][]float32, error) {
	var all [][]float32
	for i := 0; i < len(texts); i += batchSize {
		end := i + batchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch, err := v.embedBatch(ctx, texts[i:end])
		if err != nil {
			return nil, fmt.Errorf("batch %d-%d: %w", i, end, err)
		}
		all = append(all, batch...)
	}
	return all, nil
}

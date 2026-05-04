package vertex

import (
	"context"
	"fmt"
	"strings"

	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	"cloud.google.com/go/aiplatform/apiv1/aiplatformpb"
	"google.golang.org/api/option"
	"google.golang.org/protobuf/types/known/structpb"
)

// httpClient is the production Client backed by Google's aiplatform SDK
// (gRPC). Auth uses Application Default Credentials by default; pass
// option.WithCredentials(...) via opts to override.
type httpClient struct {
	pred       *aiplatform.PredictionClient
	projectID  string
	location   string
	endpointFn func(model string) string
}

// NewClient builds a Client against Vertex AI's prediction API for the
// given project/location. Pass option.WithCredentials etc. via opts.
func NewClient(ctx context.Context, projectID, location string, opts ...option.ClientOption) (Client, error) {
	if projectID == "" {
		return nil, fmt.Errorf("vertex: projectID is required")
	}
	location = strings.TrimSpace(location)
	if location == "" {
		location = "global"
	}
	// Regional endpoints follow the {location}-aiplatform.googleapis.com
	// pattern; "global" lives at aiplatform.googleapis.com directly.
	endpoint := "aiplatform.googleapis.com:443"
	if location != "global" {
		endpoint = fmt.Sprintf("%s-aiplatform.googleapis.com:443", location)
	}
	clientOpts := append([]option.ClientOption{option.WithEndpoint(endpoint)}, opts...)

	pred, err := aiplatform.NewPredictionClient(ctx, clientOpts...)
	if err != nil {
		return nil, fmt.Errorf("vertex: new prediction client: %w", err)
	}

	return &httpClient{
		pred:      pred,
		projectID: projectID,
		location:  location,
		endpointFn: func(model string) string {
			return fmt.Sprintf("projects/%s/locations/%s/publishers/google/models/%s",
				projectID, location, model)
		},
	}, nil
}

func (c *httpClient) PredictEmbeddings(ctx context.Context, model string, texts []string, dim int, taskType string) (EmbeddingResult, error) {
	instances := make([]*structpb.Value, len(texts))
	for i, t := range texts {
		v, err := structpb.NewValue(map[string]any{
			"content":   t,
			"task_type": taskType,
		})
		if err != nil {
			return EmbeddingResult{}, fmt.Errorf("vertex: build instance %d: %w", i, err)
		}
		instances[i] = v
	}

	req := &aiplatformpb.PredictRequest{
		Endpoint:  c.endpointFn(model),
		Instances: instances,
	}
	if dim > 0 {
		params, err := structpb.NewValue(map[string]any{"outputDimensionality": dim})
		if err != nil {
			return EmbeddingResult{}, fmt.Errorf("vertex: build parameters: %w", err)
		}
		req.Parameters = params
	}

	resp, err := c.pred.Predict(ctx, req)
	if err != nil {
		return EmbeddingResult{}, fmt.Errorf("vertex: predict: %w", err)
	}
	if len(resp.GetPredictions()) != len(texts) {
		return EmbeddingResult{}, fmt.Errorf("vertex: got %d predictions for %d inputs", len(resp.GetPredictions()), len(texts))
	}

	result := EmbeddingResult{
		Vectors: make([][]float32, len(resp.GetPredictions())),
	}
	for i, pred := range resp.GetPredictions() {
		emb := pred.GetStructValue().GetFields()["embeddings"].GetStructValue()
		vals := emb.GetFields()["values"].GetListValue().GetValues()
		vec := make([]float32, len(vals))
		for j, v := range vals {
			vec[j] = float32(v.GetNumberValue())
		}
		result.Vectors[i] = vec
		// statistics.token_count is a float in the response; sum across predictions.
		stats := emb.GetFields()["statistics"].GetStructValue()
		if stats != nil {
			result.InputTokens += int(stats.GetFields()["token_count"].GetNumberValue())
		}
	}
	return result, nil
}

// Close releases the underlying gRPC connection.
func (c *httpClient) Close() error {
	if c.pred == nil {
		return nil
	}
	return c.pred.Close()
}

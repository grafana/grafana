package azure

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
)

// restClient calls the Azure OpenAI embeddings REST API for a single
// deployment. Construct with NewClient.
type restClient struct {
	httpClient *http.Client
	endpoint   string // base resource URL, e.g. https://my-resource.openai.azure.com
	deployment string
	apiVersion string
	apiKey     string
}

// NewClient builds a Client for the given Azure OpenAI resource endpoint and
// embeddings deployment. Authentication uses the static API key via the
// `api-key` header (the caller populates it from the AZURE_OPENAI_API_KEY env
// var). deployment is the Azure deployment name, not the base model name.
func NewClient(endpoint, deployment, apiVersion, apiKey string) (Client, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("azure: endpoint is required")
	}
	if deployment == "" {
		return nil, fmt.Errorf("azure: deployment is required")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("azure: api key is required")
	}
	if apiVersion == "" {
		apiVersion = "2024-02-01"
	}
	return &restClient{
		httpClient: &http.Client{},
		endpoint:   strings.TrimRight(endpoint, "/"),
		deployment: deployment,
		apiVersion: apiVersion,
		apiKey:     apiKey,
	}, nil
}

// embedRequest is the JSON body the Azure OpenAI embeddings endpoint expects.
type embedRequest struct {
	Input          []string `json:"input"`
	EncodingFormat string   `json:"encoding_format"`
	Dimensions     int      `json:"dimensions,omitempty"`
}

// embedResponse is the OpenAI-compatible embeddings response. Each datum
// carries the index of its input so the caller can restore input order.
type embedResponse struct {
	Data []struct {
		Index     int       `json:"index"`
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

func (c *restClient) EmbedTexts(ctx context.Context, texts []string, dimensions int) (EmbedResult, error) {
	reqBody := embedRequest{Input: texts, EncodingFormat: "float"}
	if dimensions > 0 {
		reqBody.Dimensions = dimensions
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return EmbedResult{}, fmt.Errorf("azure: marshal embed request: %w", err)
	}

	url := fmt.Sprintf("%s/openai/deployments/%s/embeddings?api-version=%s", c.endpoint, c.deployment, c.apiVersion)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return EmbedResult{}, fmt.Errorf("azure: new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return EmbedResult{}, fmt.Errorf("azure: embeddings request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return EmbedResult{}, fmt.Errorf("azure: embeddings returned %s: %s", resp.Status, strings.TrimSpace(string(snippet)))
	}

	var parsed embedResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return EmbedResult{}, fmt.Errorf("azure: decode embed response: %w", err)
	}
	if len(parsed.Data) != len(texts) {
		return EmbedResult{}, fmt.Errorf("azure: got %d vectors for %d inputs", len(parsed.Data), len(texts))
	}

	// The API tags each embedding with the index of its input; sort by that
	// index so the output order matches the input order regardless of any
	// reordering on the wire.
	sort.Slice(parsed.Data, func(i, j int) bool {
		return parsed.Data[i].Index < parsed.Data[j].Index
	})

	vectors := make([][]float32, len(parsed.Data))
	for i, d := range parsed.Data {
		vectors[i] = d.Embedding
	}
	return EmbedResult{Vectors: vectors, InputTokens: parsed.Usage.PromptTokens}, nil
}

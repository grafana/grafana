package azure

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/azure"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

const (
	retryAfterMsHeader = "Retry-After-Ms"
	retryAfterHeader   = "Retry-After"
)

// restClient wraps the OpenAI SDK configured for an Azure OpenAI deployment.
type restClient struct {
	client     openai.Client
	deployment string
}

var _ Client = (*restClient)(nil)

// NewClient builds a Client for the given Azure OpenAI resource endpoint and
// embeddings deployment, authenticating with the static API key. The openai-go
// azure helpers route requests to
// {endpoint}/openai/deployments/{deployment}/embeddings?api-version=... and set
// the `api-key` header. deployment is the Azure deployment name, not the base
// model name.
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
		client: openai.NewClient(
			azure.WithEndpoint(endpoint, apiVersion),
			azure.WithAPIKey(apiKey),
		),
		deployment: deployment,
	}, nil
}

func (c *restClient) EmbedTexts(ctx context.Context, texts []string, dimensions int) (EmbedResult, error) {
	params := openai.EmbeddingNewParams{
		Model:          c.deployment, // for Azure this is the deployment name
		Input:          openai.EmbeddingNewParamsInputUnion{OfArrayOfStrings: texts},
		EncodingFormat: openai.EmbeddingNewParamsEncodingFormatFloat,
	}
	if dimensions > 0 {
		params.Dimensions = openai.Int(int64(dimensions))
	}

	resp, err := c.client.Embeddings.New(ctx, params)
	if err != nil {
		return EmbedResult{}, fmt.Errorf("azure: embeddings: %w", retryableError(err, time.Now()))
	}
	if len(resp.Data) != len(texts) {
		return EmbedResult{}, fmt.Errorf("azure: got %d vectors for %d inputs", len(resp.Data), len(texts))
	}

	// Each datum carries the index of its input; assign positionally so the
	// output order matches the input order regardless of response ordering.
	vectors := make([][]float32, len(texts))
	for _, d := range resp.Data {
		v := make([]float32, len(d.Embedding))
		for i, f := range d.Embedding {
			v[i] = float32(f)
		}
		vectors[d.Index] = v
	}
	return EmbedResult{Vectors: vectors, InputTokens: int(resp.Usage.PromptTokens)}, nil
}

func retryableError(err error, now time.Time) error {
	var netErr net.Error
	retryable := errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout())
	var apiErr *openai.Error
	var delay time.Duration
	if errors.As(err, &apiErr) {
		retryable = apiErr.StatusCode == http.StatusRequestTimeout || apiErr.StatusCode == http.StatusConflict || apiErr.StatusCode == http.StatusTooManyRequests || apiErr.StatusCode >= http.StatusInternalServerError
		if retryable && apiErr.Response != nil {
			delay = retryAfter(apiErr.Response.Header, now)
		}
	}
	if !retryable {
		return err
	}
	return &embedder.RetryableError{Err: err, RetryAfter: delay}
}

func retryAfter(headers http.Header, now time.Time) time.Duration {
	// Azure's millisecond hint is more precise than Retry-After.
	for _, hint := range []struct {
		name string
		unit time.Duration
	}{
		{retryAfterMsHeader, time.Millisecond},
		{retryAfterHeader, time.Second},
	} {
		value := strings.TrimSpace(headers.Get(hint.name))
		if value == "" {
			continue
		}
		if n, err := strconv.ParseFloat(value, 64); err == nil && n > 0 && n < float64(math.MaxInt64)/float64(hint.unit) {
			return time.Duration(n * float64(hint.unit))
		}
		if hint.name == retryAfterHeader {
			if deadline, err := http.ParseTime(value); err == nil {
				return max(0, deadline.Sub(now))
			}
		}
	}
	return 0
}

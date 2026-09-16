package bedrock

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/aws/smithy-go"
	smithymiddleware "github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

const retryAfterHeader = "X-Amz-Retry-After"

// runtimeAPI is the subset of the Bedrock runtime SDK we use; declaring it
// as an interface keeps the client testable without a live AWS client.
type runtimeAPI interface {
	InvokeModel(ctx context.Context, params *bedrockruntime.InvokeModelInput, optFns ...func(*bedrockruntime.Options)) (*bedrockruntime.InvokeModelOutput, error)
}

// awsClient is the production Client backed by aws-sdk-go-v2's
// bedrockruntime. Construct with NewClient.
type awsClient struct {
	runtime runtimeAPI
}

// NewClient wraps an existing bedrockruntime client. Caller is responsible
// for region + credential configuration via aws.Config (use the standard
// AWS_REGION + default credential chain in most cases).
func NewClient(rt *bedrockruntime.Client) Client {
	return &awsClient{runtime: rt}
}

// cohereEmbedRequest is the JSON body Cohere embed-v4 expects on Bedrock.
type cohereEmbedRequest struct {
	Texts           []string `json:"texts"`
	InputType       string   `json:"input_type"`
	EmbeddingTypes  []string `json:"embedding_types"`
	OutputDimension int      `json:"output_dimension,omitempty"`
}

type cohereEmbedResponse struct {
	Embeddings struct {
		Float [][]float64 `json:"float"`
	} `json:"embeddings"`
	ResponseType string `json:"response_type"`
}

func (c *awsClient) EmbedTexts(ctx context.Context, model string, texts []string, inputType string, outputDimension int) (EmbedResult, error) {
	req := cohereEmbedRequest{
		Texts:          texts,
		InputType:      inputType,
		EmbeddingTypes: []string{"float"},
	}
	if outputDimension > 0 {
		req.OutputDimension = outputDimension
	}

	body, err := json.Marshal(req)
	if err != nil {
		return EmbedResult{}, fmt.Errorf("bedrock: marshal embed request: %w", err)
	}

	out, err := c.runtime.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(model),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        body,
	})
	if err != nil {
		return EmbedResult{}, fmt.Errorf("bedrock: invoke: %w", retryableError(err))
	}

	var resp cohereEmbedResponse
	if err := json.Unmarshal(out.Body, &resp); err != nil {
		return EmbedResult{}, fmt.Errorf("bedrock: unmarshal embed response: %w", err)
	}
	if len(resp.Embeddings.Float) != len(texts) {
		return EmbedResult{}, fmt.Errorf("bedrock: got %d vectors for %d inputs", len(resp.Embeddings.Float), len(texts))
	}

	vectors := make([][]float32, len(resp.Embeddings.Float))
	for i, vec64 := range resp.Embeddings.Float {
		vec32 := make([]float32, len(vec64))
		for j, v := range vec64 {
			vec32[j] = float32(v)
		}
		vectors[i] = vec32
	}

	return EmbedResult{
		Vectors:     vectors,
		InputTokens: inputTokensFromMetadata(out.ResultMetadata),
	}, nil
}

// inputTokensFromMetadata extracts the billed input token count from the
// X-Amzn-Bedrock-Input-Token-Count response header via SDK result metadata.
// Returns 0 when the header is missing or unparseable.
func inputTokensFromMetadata(md smithymiddleware.Metadata) int {
	raw := awsmiddleware.GetRawResponse(md)
	if raw == nil {
		return 0
	}
	resp, ok := raw.(*smithyhttp.Response)
	if !ok {
		return 0
	}
	n, _ := strconv.Atoi(resp.Header.Get("X-Amzn-Bedrock-Input-Token-Count"))
	return n
}

func retryableError(err error) error {
	var netErr net.Error
	retryable := errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout())
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.(type) {
		case *types.ThrottlingException, *types.ServiceQuotaExceededException, *types.ServiceUnavailableException, *types.InternalServerException, *types.ModelTimeoutException, *types.ModelNotReadyException:
			retryable = true
		}
	}
	if !retryable {
		return err
	}
	var delay time.Duration
	var responseErr *smithyhttp.ResponseError
	if errors.As(err, &responseErr) && responseErr.Response != nil && responseErr.Response.Response != nil {
		value := strings.TrimSpace(responseErr.Response.Header.Get(retryAfterHeader))
		if ms, parseErr := strconv.ParseInt(value, 10, 64); parseErr == nil && ms > 0 && ms <= math.MaxInt64/int64(time.Millisecond) {
			delay = time.Duration(ms) * time.Millisecond
		}
	}
	return &embedder.RetryableError{Err: err, RetryAfter: delay}
}

package bedrock

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/aws/smithy-go"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type fakeClient struct {
	wantErr   error
	mu        sync.Mutex
	calls     [][]string
	dim       int
	tokens    int
	failAfter int32
	callNum   int32
	wantInput string
}

func (f *fakeClient) EmbedTexts(_ context.Context, _ string, texts []string, inputType string, _ int) (EmbedResult, error) {
	if f.wantErr != nil {
		return EmbedResult{}, f.wantErr
	}
	n := atomic.AddInt32(&f.callNum, 1)
	f.mu.Lock()
	f.calls = append(f.calls, texts)
	f.wantInput = inputType
	f.mu.Unlock()

	if f.failAfter > 0 && n == f.failAfter {
		return EmbedResult{}, errors.New("synthetic failure")
	}
	res := EmbedResult{
		Vectors:     make([][]float32, len(texts)),
		InputTokens: f.tokens,
	}
	for i := range texts {
		v := make([]float32, f.dim)
		v[0] = float32(len(texts[i]))
		res.Vectors[i] = v
	}
	return res, nil
}

func TestDenseEmbedder_EmbedText_ChunksAtDefaultBatchSize(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)

	// 130 inputs at DefaultBatchSize=50 → 3 chunks (50 + 50 + 30).
	texts := make([]string, 130)
	for i := range texts {
		texts[i] = "x"
	}
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: texts})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 130)

	fc.mu.Lock()
	sizes := make([]int, len(fc.calls))
	for i, c := range fc.calls {
		sizes[i] = len(c)
	}
	fc.mu.Unlock()
	assert.ElementsMatch(t, []int{50, 50, 30}, sizes)
}

func TestDenseEmbedder_EmbedText_HonorsConfiguredBatchSize(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 32)

	// 80 inputs at batchSize=32 → 3 chunks (32 + 32 + 16).
	texts := make([]string, 80)
	for i := range texts {
		texts[i] = "x"
	}
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: texts})
	require.NoError(t, err)

	fc.mu.Lock()
	sizes := make([]int, len(fc.calls))
	for i, c := range fc.calls {
		sizes[i] = len(c)
	}
	fc.mu.Unlock()
	assert.ElementsMatch(t, []int{32, 32, 16}, sizes)
}

func TestDenseEmbedder_EmbedText_PassesInputType(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)

	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{
		Texts: []string{"a"},
		Task:  embedder.TaskRetrievalQuery,
	})
	require.NoError(t, err)
	assert.Equal(t, "search_query", fc.wantInput)
}

func TestDenseEmbedder_EmbedText_DefaultsToSearchDocument(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"a"}})
	require.NoError(t, err)
	assert.Equal(t, "search_document", fc.wantInput)
}

func TestDenseEmbedder_EmbedText_NormalizesWhenAsked(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{
		Texts:     []string{"abcd"},
		Normalize: true,
	})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 1)
	v := out.Embeddings[0].Dense
	assert.InDelta(t, 1.0, v[0], 1e-6)
	assert.Equal(t, float32(0), v[1])
}

func TestDenseEmbedder_EmbedText_EmptyInput(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: -1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{})
	require.NoError(t, err)
	assert.Empty(t, out.Embeddings)
	assert.Empty(t, fc.calls)
}

func TestDenseEmbedder_EmbedText_PropagatesError(t *testing.T) {
	fc := &fakeClient{dim: 3, failAfter: 1}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)
	_, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"a", "b"}})
	require.Error(t, err)
}

func TestDenseEmbedder_EmbedText_SumsTokensAcrossChunks(t *testing.T) {
	fc := &fakeClient{dim: 4, failAfter: -1, tokens: 7}
	e := NewDenseEmbedder(fc, "cohere.embed-v4:0", 0, 50)

	// 130 inputs at batchSize=50 → 3 concurrent chunks, each reporting 7
	// tokens; the sum must land on the output despite concurrent dispatch.
	texts := make([]string, 130)
	for i := range texts {
		texts[i] = "x"
	}
	out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: texts})
	require.NoError(t, err)
	assert.Equal(t, 21, out.InputTokens)
}

func TestDenseEmbedder_EmbedText_RetryableCallTimeout(t *testing.T) {
	ctx, cancel := context.WithCancelCause(t.Context())
	cancel(ErrCallTimeout)
	fc := &fakeClient{wantErr: context.Canceled}
	e := NewDenseEmbedder(fc, "model", 4, 1)
	_, err := e.EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"CPU usage"}})
	var retryErr *embedder.RetryableError
	require.ErrorAs(t, err, &retryErr)
	assert.ErrorIs(t, err, ErrCallTimeout)
	assert.Zero(t, retryErr.RetryAfter)
}

type failingRuntime struct{ err error }

func (f failingRuntime) InvokeModel(context.Context, *bedrockruntime.InvokeModelInput, ...func(*bedrockruntime.Options)) (*bedrockruntime.InvokeModelOutput, error) {
	return nil, f.err
}

func TestClientRetryableError(t *testing.T) {
	for _, original := range []smithy.APIError{
		&types.ThrottlingException{}, &types.ServiceQuotaExceededException{}, &types.ServiceUnavailableException{},
		&types.InternalServerException{}, &types.ModelTimeoutException{}, &types.ModelNotReadyException{},
		&types.ValidationException{}, &types.AccessDeniedException{},
	} {
		t.Run(original.ErrorCode(), func(t *testing.T) {
			h := http.Header{}
			h.Set(retryAfterHeader, "120000")
			err := &smithyhttp.ResponseError{Response: &smithyhttp.Response{Response: &http.Response{StatusCode: http.StatusTooManyRequests, Header: h}}, Err: original}
			c := &awsClient{runtime: failingRuntime{err: fmt.Errorf("SDK: %w", err)}}
			_, got := c.EmbedTexts(t.Context(), "model", []string{"CPU usage"}, "search_document", 4)
			wantRetry := true
			switch original.(type) {
			case *types.ValidationException, *types.AccessDeniedException:
				wantRetry = false
			}
			var retryErr *embedder.RetryableError
			require.Equal(t, wantRetry, errors.As(got, &retryErr))
			assert.ErrorIs(t, got, original)
			if retryErr != nil {
				assert.Equal(t, 2*time.Minute, retryErr.RetryAfter)
			}
		})
	}
	for _, hint := range []string{"", "invalid", "-1", "9223372036854775807"} {
		t.Run("invalid hint "+hint, func(t *testing.T) {
			h := http.Header{}
			h.Set(retryAfterHeader, hint)
			err := &smithyhttp.ResponseError{Response: &smithyhttp.Response{Response: &http.Response{StatusCode: http.StatusTooManyRequests, Header: h}}, Err: &types.ThrottlingException{}}
			var retryErr *embedder.RetryableError
			require.ErrorAs(t, retryableError(err), &retryErr)
			assert.Zero(t, retryErr.RetryAfter)
		})
	}
}

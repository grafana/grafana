package azure

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// TestRestClient_EmbedTexts drives the SDK-backed client against a stub Azure
// OpenAI endpoint and verifies our mapping: deployment → URL path, dimensions
// passthrough, api-key auth, and index-addressed ordering of the result.
func TestRestClient_EmbedTexts(t *testing.T) {
	var gotPath, gotQuery, gotKey, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		gotKey = r.Header.Get("api-key")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.Header().Set("Content-Type", "application/json")
		// Data returned out of order to verify the client restores input order by index.
		_, _ = w.Write([]byte(`{"object":"list","data":[{"object":"embedding","index":1,"embedding":[3,4]},{"object":"embedding","index":0,"embedding":[1,2]}],"model":"text-embedding-3-small","usage":{"prompt_tokens":7,"total_tokens":7}}`))
	}))
	defer srv.Close()

	c, err := NewClient(srv.URL, "text-embedding-3-small", "2024-02-01", "secret-key")
	require.NoError(t, err)

	res, err := c.EmbedTexts(context.Background(), []string{"a", "b"}, 1024)
	require.NoError(t, err)

	assert.Contains(t, gotPath, "/openai/deployments/text-embedding-3-small/embeddings")
	assert.Contains(t, gotQuery, "api-version=2024-02-01")
	assert.Equal(t, "secret-key", gotKey)
	assert.Contains(t, gotBody, `"dimensions":1024`)
	// Sorted by index: input 0 → [1,2], input 1 → [3,4].
	require.Equal(t, [][]float32{{1, 2}, {3, 4}}, res.Vectors)
	assert.Equal(t, 7, res.InputTokens)
}

func TestRestClient_EmbedTexts_OmitsDimensionsWhenZero(t *testing.T) {
	var gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"index":0,"embedding":[1,2]}],"usage":{"prompt_tokens":1}}`))
	}))
	defer srv.Close()

	c, err := NewClient(srv.URL, "dep", "2024-02-01", "k")
	require.NoError(t, err)
	_, err = c.EmbedTexts(context.Background(), []string{"a"}, 0)
	require.NoError(t, err)
	assert.NotContains(t, gotBody, "dimensions")
}

func TestRestClient_EmbedTexts_CountMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"index":0,"embedding":[1,2]}],"usage":{"prompt_tokens":1}}`))
	}))
	defer srv.Close()

	c, err := NewClient(srv.URL, "dep", "2024-02-01", "k")
	require.NoError(t, err)
	_, err = c.EmbedTexts(context.Background(), []string{"a", "b"}, 0)
	require.Error(t, err)
}

func TestNewClient_Validation(t *testing.T) {
	_, err := NewClient("", "dep", "v", "k")
	require.Error(t, err)
	_, err = NewClient("https://x", "", "v", "k")
	require.Error(t, err)
	_, err = NewClient("https://x", "dep", "v", "")
	require.Error(t, err)
}

type testTokenCredential struct {
	options policy.TokenRequestOptions
	err     error
}

func (c *testTokenCredential) GetToken(_ context.Context, options policy.TokenRequestOptions) (azcore.AccessToken, error) {
	c.options = options
	return azcore.AccessToken{Token: "test-entra-token", ExpiresOn: time.Now().Add(time.Hour)}, c.err
}

func TestRestClient_EmbedTexts_TokenCredential(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "unrelated-openai-key")
	credential := &testTokenCredential{}
	var authorization, apiKey, path, version string
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		apiKey = r.Header.Get("api-key")
		path = r.URL.Path
		version = r.URL.Query().Get("api-version")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"index":0,"embedding":[1,2]}],"usage":{"prompt_tokens":1}}`))
	}))
	defer srv.Close()

	client, err := NewClientWithTokenCredential(srv.URL, "dep", "", credential)
	require.NoError(t, err)
	rest := client.(*restClient)
	rest.client = openai.NewClient(append(rest.client.Options, option.WithHTTPClient(srv.Client()))...)
	res, err := client.EmbedTexts(context.Background(), []string{"text"}, 0)
	require.NoError(t, err)
	assert.Equal(t, "Bearer test-entra-token", authorization)
	assert.Empty(t, apiKey)
	assert.Equal(t, []string{"https://cognitiveservices.azure.com/.default"}, credential.options.Scopes)
	assert.Equal(t, "/openai/deployments/dep/embeddings", path)
	assert.Equal(t, "2024-02-01", version)
	assert.Equal(t, [][]float32{{1, 2}}, res.Vectors)
}

func TestRestClient_EmbedTexts_TokenCredentialError(t *testing.T) {
	cause := errors.New("token acquisition failed")
	client, err := NewClientWithTokenCredential("https://example.openai.azure.com", "dep", "", &testTokenCredential{err: cause})
	require.NoError(t, err)
	_, err = client.EmbedTexts(context.Background(), []string{"text"}, 0)
	require.ErrorIs(t, err, cause)
}

func TestNewClientWithTokenCredential_Validation(t *testing.T) {
	for _, tt := range []struct {
		endpoint   string
		deployment string
		credential azcore.TokenCredential
	}{
		{"", "dep", &testTokenCredential{}},
		{"https://example.openai.azure.com", "", &testTokenCredential{}},
		{"https://example.openai.azure.com", "dep", nil},
	} {
		_, err := NewClientWithTokenCredential(tt.endpoint, tt.deployment, "", tt.credential)
		require.Error(t, err)
	}
}

func TestRetryableError(t *testing.T) {
	now := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	for _, tt := range []struct {
		code      int
		retryable bool
	}{
		{http.StatusRequestTimeout, true},
		{http.StatusConflict, true},
		{http.StatusTooManyRequests, true},
		{http.StatusInternalServerError, true},
		{http.StatusBadGateway, true},
		{http.StatusServiceUnavailable, true},
		{http.StatusGatewayTimeout, true},
		{http.StatusBadRequest, false},
		{http.StatusUnauthorized, false},
		{http.StatusNotImplemented, false},
		{http.StatusHTTPVersionNotSupported, false},
	} {
		t.Run(fmt.Sprint(tt.code), func(t *testing.T) {
			original := &openai.Error{StatusCode: tt.code, Response: &http.Response{Header: http.Header{retryAfterMsHeader: []string{"90000"}}}}
			err := retryableError(original, now)
			var retryErr *embedder.RetryableError
			require.Equal(t, tt.retryable, errors.As(err, &retryErr))
			assert.ErrorIs(t, err, original)
			if retryErr != nil {
				assert.Equal(t, 90*time.Second, retryErr.RetryAfter)
			}
		})
	}
	for _, cause := range []error{context.DeadlineExceeded, context.Canceled, errors.New("unknown")} {
		var retryErr *embedder.RetryableError
		err := retryableError(fmt.Errorf("client: %w", cause), now)
		assert.Equal(t, errors.Is(cause, context.DeadlineExceeded), errors.As(err, &retryErr))
		assert.ErrorIs(t, err, cause)
	}
}

func TestRetryAfter(t *testing.T) {
	now := time.Date(2026, 9, 10, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name    string
		ms      string
		seconds string
		want    time.Duration
	}{
		{"milliseconds", "90000", "", 90 * time.Second},
		{"seconds", "", "120", 2 * time.Minute},
		{"fractional seconds", "", "1.5", 1500 * time.Millisecond},
		{"prefer milliseconds", "1500", "2", 1500 * time.Millisecond},
		{"invalid milliseconds falls back", "invalid", "2", 2 * time.Second},
		{"HTTP date", "", now.Add(3 * time.Minute).Format(http.TimeFormat), 3 * time.Minute},
		{"past date", "", now.Add(-time.Minute).Format(http.TimeFormat), 0},
		{"negative", "-60", "-60", 0},
		{"invalid", "", "tomorrow", 0},
		{"overflow", "1e100", "1e100", 0},
		{"NaN", "NaN", "NaN", 0},
		{"infinity", "+Inf", "+Inf", 0},
		{"missing", "", "", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := http.Header{}
			h.Set(retryAfterMsHeader, tt.ms)
			h.Set(retryAfterHeader, tt.seconds)
			assert.Equal(t, tt.want, retryAfter(h, now))
		})
	}
}

func TestRestClient_EmbedTexts_ReturnsRetryHint(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set(retryAfterMsHeader, "90000")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"quota exhausted","type":"rate_limit_error","code":"429"}}`))
	}))
	defer srv.Close()
	c := &restClient{client: openai.NewClient(option.WithBaseURL(srv.URL), option.WithAPIKey("test"), option.WithMaxRetries(0)), deployment: "dep"}
	_, err := c.EmbedTexts(t.Context(), []string{"CPU usage"}, 4)
	var retryErr *embedder.RetryableError
	require.ErrorAs(t, err, &retryErr)
	assert.Equal(t, 90*time.Second, retryErr.RetryAfter)
	var apiErr *openai.Error
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
}

package azure

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRestClient_EmbedTexts(t *testing.T) {
	var gotTarget, gotKey, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTarget = r.URL.Path + "?" + r.URL.RawQuery
		gotKey = r.Header.Get("api-key")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.Header().Set("Content-Type", "application/json")
		// Return data out of order to verify the client restores input order by index.
		_, _ = w.Write([]byte(`{"data":[{"index":1,"embedding":[3,4]},{"index":0,"embedding":[1,2]}],"usage":{"prompt_tokens":7,"total_tokens":7}}`))
	}))
	defer srv.Close()

	c, err := NewClient(srv.URL, "text-embedding-3-large", "2024-02-01", "secret-key")
	require.NoError(t, err)

	res, err := c.EmbedTexts(context.Background(), []string{"a", "b"}, 1024)
	require.NoError(t, err)

	assert.Equal(t, "/openai/deployments/text-embedding-3-large/embeddings?api-version=2024-02-01", gotTarget)
	assert.Equal(t, "secret-key", gotKey)
	assert.Contains(t, gotBody, `"dimensions":1024`)
	assert.Contains(t, gotBody, `"encoding_format":"float"`)
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

func TestRestClient_EmbedTexts_ErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"bad key"}`))
	}))
	defer srv.Close()

	c, err := NewClient(srv.URL, "dep", "2024-02-01", "k")
	require.NoError(t, err)
	_, err = c.EmbedTexts(context.Background(), []string{"a"}, 0)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "401")
}

func TestRestClient_EmbedTexts_CountMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"index":0,"embedding":[1,2]}]}`))
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

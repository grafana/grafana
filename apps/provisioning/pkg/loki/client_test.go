package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSample_MarshalJSON(t *testing.T) {
	sample := Sample{
		T: time.Unix(0, 1234567890000000000), // 1234567890 seconds in nanoseconds
		V: "test log line",
	}

	data, err := json.Marshal(sample)
	require.NoError(t, err)

	expected := `["1234567890000000000","test log line"]`
	assert.JSONEq(t, expected, string(data))
}

func TestSample_UnmarshalJSON(t *testing.T) {
	t.Run("valid sample", func(t *testing.T) {
		data := `["1234567890000000000","test log line"]`
		var sample Sample

		err := json.Unmarshal([]byte(data), &sample)
		require.NoError(t, err)

		assert.Equal(t, time.Unix(0, 1234567890000000000), sample.T)
		assert.Equal(t, "test log line", sample.V)
	})

	t.Run("invalid format", func(t *testing.T) {
		data := `"invalid"`
		var sample Sample

		err := json.Unmarshal([]byte(data), &sample)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to deserialize sample")
	})

	t.Run("invalid timestamp", func(t *testing.T) {
		data := `["not-a-number","test log line"]`
		var sample Sample

		err := json.Unmarshal([]byte(data), &sample)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "timestamp in Loki sample not convertible")
	})
}

func TestClient_Push(t *testing.T) {
	t.Run("successful push", func(t *testing.T) {
		var receivedBody PushRequest
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/loki/api/v1/push", r.URL.Path)
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

			err := json.NewDecoder(r.Body).Decode(&receivedBody)
			require.NoError(t, err)

			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		streams := []Stream{
			{
				Stream: map[string]string{"job": "test"},
				Values: []Sample{
					{T: time.Unix(0, 1234567890000000000), V: "log line 1"},
					{T: time.Unix(0, 1234567891000000000), V: "log line 2"},
				},
			},
		}

		err := client.Push(context.Background(), streams)
		assert.NoError(t, err)

		// Verify the request body
		assert.Len(t, receivedBody.Streams, 1)
		assert.Equal(t, "test", receivedBody.Streams[0].Stream["job"])
		assert.Len(t, receivedBody.Streams[0].Values, 2)
	})

	t.Run("push failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("Bad request"))
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		streams := []Stream{{Stream: map[string]string{"job": "test"}}}
		err := client.Push(context.Background(), streams)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "non-200 response")
	})
}

func TestClient_RangeQuery(t *testing.T) {
	t.Run("successful query", func(t *testing.T) {
		expectedResponse := QueryRes{
			Data: QueryData{
				Result: []Stream{
					{
						Stream: map[string]string{"job": "test"},
						Values: []Sample{
							{T: time.Unix(0, 1234567890000000000), V: "log line 1"},
							{T: time.Unix(0, 1234567891000000000), V: "log line 2"},
						},
					},
				},
			},
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/loki/api/v1/query_range", r.URL.Path)
			assert.Equal(t, http.MethodGet, r.Method)

			// Check query parameters
			params := r.URL.Query()
			assert.Equal(t, `{job="test"}`, params.Get("query"))
			assert.Equal(t, "1000000000", params.Get("start"))
			assert.Equal(t, "2000000000", params.Get("end"))
			assert.Equal(t, "100", params.Get("limit"))

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(expectedResponse)
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		result, err := client.RangeQuery(
			context.Background(),
			`{job="test"}`,
			1000000000, // start
			2000000000, // end
			100,        // limit
		)

		assert.NoError(t, err)
		assert.Len(t, result.Data.Result, 1)
		assert.Equal(t, "test", result.Data.Result[0].Stream["job"])
		assert.Len(t, result.Data.Result[0].Values, 2)
	})

	t.Run("query without limit", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			params := r.URL.Query()
			assert.Equal(t, "", params.Get("limit")) // Should not be set

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(QueryRes{})
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		_, err := client.RangeQuery(context.Background(), `{job="test"}`, 1000000000, 2000000000, 0)
		assert.NoError(t, err)
	})

	t.Run("query failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("Bad query"))
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		_, err := client.RangeQuery(context.Background(), `{job="test"}`, 1000000000, 2000000000, 100)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "non-200 response")
	})

	t.Run("invalid JSON response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte("invalid json"))
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		_, err := client.RangeQuery(context.Background(), `{job="test"}`, 1000000000, 2000000000, 100)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "error unmarshaling loki response")
	})
}

func TestClient_setAuthAndTenantHeaders(t *testing.T) {
	t.Run("with basic auth and tenant", func(t *testing.T) {
		cfg := createTestConfig(t, "http://localhost", "http://localhost")
		cfg.BasicAuthUser = "testuser"
		cfg.BasicAuthPassword = "testpass"
		cfg.TenantID = "test-tenant"

		client := NewClient(cfg)

		req, _ := http.NewRequest(http.MethodGet, "http://localhost", nil)
		client.setAuthAndTenantHeaders(req)

		username, password, ok := req.BasicAuth()
		assert.True(t, ok)
		assert.Equal(t, "testuser", username)
		assert.Equal(t, "testpass", password)
		assert.Equal(t, "test-tenant", req.Header.Get("X-Scope-OrgID"))
	})

	t.Run("without auth", func(t *testing.T) {
		cfg := createTestConfig(t, "http://localhost", "http://localhost")
		client := NewClient(cfg)

		req, _ := http.NewRequest(http.MethodGet, "http://localhost", nil)
		client.setAuthAndTenantHeaders(req)

		_, _, ok := req.BasicAuth()
		assert.False(t, ok)
		assert.Equal(t, "", req.Header.Get("X-Scope-OrgID"))
	})
}

func TestStream_JSONRoundtrip(t *testing.T) {
	original := Stream{
		Stream: map[string]string{
			"job":       "test-job",
			"instance":  "test-instance",
			"namespace": "test-ns",
		},
		Values: []Sample{
			{T: time.Unix(0, 1234567890000000000), V: "log line 1"},
			{T: time.Unix(0, 1234567891000000000), V: "log line 2"},
			{T: time.Unix(0, 1234567892000000000), V: "log line 3"},
		},
	}

	// Marshal to JSON
	data, err := json.Marshal(original)
	require.NoError(t, err)

	// Unmarshal back
	var restored Stream
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	// Verify all fields match
	assert.Equal(t, original.Stream, restored.Stream)
	assert.Len(t, restored.Values, len(original.Values))

	for i, sample := range original.Values {
		assert.True(t, sample.T.Equal(restored.Values[i].T),
			fmt.Sprintf("Timestamp mismatch at index %d: expected %v, got %v", i, sample.T, restored.Values[i].T))
		assert.Equal(t, sample.V, restored.Values[i].V)
	}
}

// Helper functions

func createTestClient(t *testing.T, readURL, writeURL string) *Client {
	cfg := createTestConfig(t, readURL, writeURL)
	return NewClient(cfg)
}

func createTestConfig(t *testing.T, readURL, writeURL string) Config {
	readParsed, err := url.Parse(readURL)
	require.NoError(t, err)

	writeParsed, err := url.Parse(writeURL)
	require.NoError(t, err)

	return Config{
		ReadPathURL:    readParsed,
		WritePathURL:   writeParsed,
		ExternalLabels: map[string]string{"source": "test"},
		MaxQuerySize:   1000,
	}
}

func TestClient_ContextCancellation(t *testing.T) {
	t.Run("push with cancelled context", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Error("Handler should not be called with cancelled context")
		}))
		defer server.Close()

		client := createTestClient(t, server.URL, server.URL)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		streams := []Stream{{Stream: map[string]string{"job": "test"}}}
		err := client.Push(ctx, streams)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "context canceled")
	})
}

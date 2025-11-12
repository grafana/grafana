package meta

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func TestCloudProvider_GetMeta(t *testing.T) {
	ctx := context.Background()

	t.Run("successfully fetches plugin metadata", func(t *testing.T) {
		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Equal(t, "/api/plugins/test-plugin/versions/1.0.0", r.URL.Path)
			assert.Equal(t, "application/json", r.Header.Get("Accept"))
			assert.Equal(t, "grafana-plugins-app", r.Header.Get("User-Agent"))

			response := grafanaComPluginVersionMeta{
				PluginID:    "test-plugin",
				Version:     "1.0.0",
				JSON:        expectedMeta,
				Description: "Test description",
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			require.NoError(t, json.NewEncoder(w).Encode(response))
		}))
		defer server.Close()

		provider := NewCloudProvider(server.URL + "/api/plugins")
		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta, result.Meta)
		assert.Equal(t, defaultCloudTTL, result.TTL)
	})

	t.Run("returns ErrMetaNotFound for 404 status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		provider := NewCloudProvider(server.URL + "/api/plugins")
		result, err := provider.GetMeta(ctx, "nonexistent-plugin", "1.0.0")

		assert.Error(t, err)
		assert.True(t, errors.Is(err, ErrMetaNotFound))
		assert.Nil(t, result)
	})

	t.Run("returns error for non-200 status codes", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		provider := NewCloudProvider(server.URL + "/api/plugins")
		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected status code 500")
		assert.Nil(t, result)
	})

	t.Run("returns error for invalid JSON response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("invalid json"))
		}))
		defer server.Close()

		provider := NewCloudProvider(server.URL + "/api/plugins")
		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to decode response")
		assert.Nil(t, result)
	})

	t.Run("returns error for invalid API URL", func(t *testing.T) {
		provider := NewCloudProvider("://invalid-url")
		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid grafana.com API URL")
		assert.Nil(t, result)
	})

	t.Run("uses custom TTL when provided", func(t *testing.T) {
		customTTL := 2 * time.Hour
		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := grafanaComPluginVersionMeta{
				PluginID: "test-plugin",
				Version:  "1.0.0",
				JSON:     expectedMeta,
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			require.NoError(t, json.NewEncoder(w).Encode(response))
		}))
		defer server.Close()

		provider := NewCloudProviderWithTTL(server.URL+"/api/plugins", customTTL)
		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, customTTL, result.TTL)
	})

	t.Run("handles context cancellation", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(100 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		provider := NewCloudProvider(server.URL + "/api/plugins")
		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestNewCloudProvider(t *testing.T) {
	t.Run("creates provider with default TTL", func(t *testing.T) {
		provider := NewCloudProvider("https://grafana.com/api/plugins")
		assert.Equal(t, defaultCloudTTL, provider.ttl)
		assert.NotNil(t, provider.httpClient)
		assert.Equal(t, "https://grafana.com/api/plugins", provider.grafanaComAPIURL)
	})

	t.Run("uses default URL when empty", func(t *testing.T) {
		provider := NewCloudProvider("")
		assert.Equal(t, "https://grafana.com/api/plugins", provider.grafanaComAPIURL)
	})
}

func TestNewCloudProviderWithTTL(t *testing.T) {
	t.Run("creates provider with custom TTL", func(t *testing.T) {
		customTTL := 2 * time.Hour
		provider := NewCloudProviderWithTTL("https://grafana.com/api/plugins", customTTL)
		assert.Equal(t, customTTL, provider.ttl)
	})

	t.Run("accepts zero TTL", func(t *testing.T) {
		provider := NewCloudProviderWithTTL("https://grafana.com/api/plugins", 0)
		assert.Equal(t, time.Duration(0), provider.ttl)
	})

	t.Run("uses default URL when empty", func(t *testing.T) {
		provider := NewCloudProviderWithTTL("", defaultCloudTTL)
		assert.Equal(t, "https://grafana.com/api/plugins", provider.grafanaComAPIURL)
	})
}

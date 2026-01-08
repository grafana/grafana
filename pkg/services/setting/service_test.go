package setting

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestRemoteSettingService_ListAsIni(t *testing.T) {
	t.Run("should return all settings with empty selector", func(t *testing.T) {
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
			{Section: "database", Key: "type", Value: "mysql"},
		}
		server := newTestServer(t, settings, "")
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.ListAsIni(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.True(t, result.HasSection("server"))
		assert.Equal(t, "3000", result.Section("server").Key("port").String())
		assert.True(t, result.HasSection("database"))
		assert.Equal(t, "mysql", result.Section("database").Key("type").String())
	})
}

func TestRemoteSettingService_List(t *testing.T) {
	t.Run("should handle single page response", func(t *testing.T) {
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
		}
		server := newTestServer(t, settings, "")
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Len(t, result, 1)
		assert.Equal(t, "server", result[0].Section)
		assert.Equal(t, "port", result[0].Key)
		assert.Equal(t, "3000", result[0].Value)
	})

	t.Run("should handle multiple settings", func(t *testing.T) {
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
			{Section: "database", Key: "host", Value: "localhost"},
			{Section: "database", Key: "port", Value: "5432"},
		}
		server := newTestServer(t, settings, "")
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Len(t, result, 3)
	})

	t.Run("should handle pagination with continue token", func(t *testing.T) {
		// First page
		page1Settings := []Setting{
			{Section: "section-0", Key: "key-0", Value: "value-0"},
			{Section: "section-0", Key: "key-1", Value: "value-1"},
		}
		// Second page
		page2Settings := []Setting{
			{Section: "section-1", Key: "key-0", Value: "value-2"},
			{Section: "section-1", Key: "key-1", Value: "value-3"},
		}

		requestCount := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestCount++
			continueToken := r.URL.Query().Get("continue")

			var settings []Setting
			var nextContinue string

			if continueToken == "" {
				settings = page1Settings
				nextContinue = "page2"
			} else {
				settings = page2Settings
				nextContinue = ""
			}

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(settings, nextContinue)))
		}))
		defer server.Close()

		client := newTestClient(t, server.URL, 2)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Len(t, result, 4)
		assert.Equal(t, 2, requestCount)
	})

	t.Run("should return error when namespace is missing", func(t *testing.T) {
		server := newTestServer(t, nil, "")
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := context.Background() // No namespace

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "missing namespace")
	})

	t.Run("should return error on HTTP error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("internal server error"))
		}))
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("should handle API errors", func(t *testing.T) {
		statusResponse := `{
			"apiVersion": "v1",
			"kind": "Status",
			"metadata": {},
			"status": "Failure",
			"message": "settings.setting.grafana.app \"test\" not found",
			"reason": "NotFound",
			"details": {
				"name": "test",
				"group": "setting.grafana.app",
				"kind": "settings"
			},
			"code": 404
		}`

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(statusResponse))
		}))
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "could not find the requested resource")
	})

	t.Run("should handle 500 internal server error", func(t *testing.T) {
		statusResponse := `{
			"apiVersion": "v1",
			"kind": "Status",
			"metadata": {},
			"status": "Failure",
			"message": "Internal error occurred: database connection failed",
			"reason": "InternalError",
			"code": 500
		}`

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(statusResponse))
		}))
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "error on the server")
	})

	t.Run("should handle connection errors", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
		serverURL := server.URL
		server.Close()

		client := newTestClient(t, serverURL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "connection refused")
	})
}

func TestParseSettingList(t *testing.T) {
	t.Run("should parse valid settings list", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v0alpha1",
			"kind": "SettingList",
			"metadata": {"continue": ""},
			"items": [
				{"spec": {"section": "database", "key": "type", "value": "postgres"}},
				{"spec": {"section": "server", "key": "port", "value": "3000"}}
			]
		}`

		settings, continueToken, err := parseSettingList(strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Len(t, settings, 2)
		assert.Equal(t, "", continueToken)
		assert.Equal(t, "database", settings[0].Section)
		assert.Equal(t, "type", settings[0].Key)
		assert.Equal(t, "postgres", settings[0].Value)
	})

	t.Run("should parse continue token", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v0alpha1",
			"kind": "SettingList",
			"metadata": {"continue": "next-page-token"},
			"items": []
		}`

		_, continueToken, err := parseSettingList(strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Equal(t, "next-page-token", continueToken)
	})

	t.Run("should handle empty items", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v0alpha1",
			"kind": "SettingList",
			"metadata": {},
			"items": []
		}`

		settings, _, err := parseSettingList(strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Len(t, settings, 0)
	})
}

func TestToIni(t *testing.T) {
	t.Run("should convert settings to ini format", func(t *testing.T) {
		settings := []*Setting{
			{Section: "database", Key: "type", Value: "postgres"},
			{Section: "database", Key: "host", Value: "localhost"},
			{Section: "server", Key: "http_port", Value: "3000"},
		}

		result, err := toIni(settings)

		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.True(t, result.HasSection("database"))
		assert.True(t, result.HasSection("server"))
		assert.Equal(t, "postgres", result.Section("database").Key("type").String())
		assert.Equal(t, "localhost", result.Section("database").Key("host").String())
		assert.Equal(t, "3000", result.Section("server").Key("http_port").String())
	})

	t.Run("should handle empty settings list", func(t *testing.T) {
		var settings []*Setting

		result, err := toIni(settings)

		require.NoError(t, err)
		assert.NotNil(t, result)
		sections := result.Sections()
		assert.Len(t, sections, 1) // Only default section
	})

	t.Run("should handle multiple keys in same section", func(t *testing.T) {
		settings := []*Setting{
			{Section: "auth", Key: "disable_login_form", Value: "false"},
			{Section: "auth", Key: "disable_signout_menu", Value: "true"},
		}

		result, err := toIni(settings)

		require.NoError(t, err)
		assert.True(t, result.HasSection("auth"))
		authSection := result.Section("auth")
		assert.Equal(t, "false", authSection.Key("disable_login_form").String())
		assert.Equal(t, "true", authSection.Key("disable_signout_menu").String())
	})
}

func TestNew(t *testing.T) {
	t.Run("should create client with default page size", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}

		client, err := New(config)

		require.NoError(t, err)
		assert.NotNil(t, client)
		remoteClient := client.(*remoteSettingService)
		assert.Equal(t, DefaultPageSize, remoteClient.pageSize)
	})

	t.Run("should create client with custom page size", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			PageSize:      100,
		}

		client, err := New(config)

		require.NoError(t, err)
		assert.NotNil(t, client)
		remoteClient := client.(*remoteSettingService)
		assert.Equal(t, int64(100), remoteClient.pageSize)
	})

	t.Run("should create client with custom QPS and Burst", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			QPS:           50.0,
			Burst:         100,
		}

		client, err := New(config)

		require.NoError(t, err)
		assert.NotNil(t, client)
	})

	t.Run("should return error when URL is empty", func(t *testing.T) {
		config := Config{
			URL: "",
		}

		client, err := New(config)

		require.Error(t, err)
		assert.Nil(t, client)
		assert.Contains(t, err.Error(), "URL cannot be empty")
	})

	t.Run("should return error when auth is not configured", func(t *testing.T) {
		config := Config{
			URL:                 "https://example.com",
			TokenExchangeClient: nil,
			WrapTransport:       nil,
		}

		client, err := New(config)

		require.Error(t, err)
		assert.Nil(t, client)
		assert.Contains(t, err.Error(), "must set either TokenExchangeClient or WrapTransport")
	})

	t.Run("should use WrapTransport when provided", func(t *testing.T) {
		wrapTransportCalled := false

		config := Config{
			URL: "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
				wrapTransportCalled = true
				return rt
			},
		}

		client, err := New(config)

		require.NoError(t, err)
		assert.NotNil(t, client)
		assert.True(t, wrapTransportCalled)
	})
}

// Helper functions

func newTestServer(t *testing.T, settings []Setting, continueToken string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(generateSettingsJSON(settings, continueToken)))
	}))
}

func newTestClient(t *testing.T, serverURL string, pageSize int64) Service {
	t.Helper()
	config := Config{
		URL:           serverURL,
		WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		PageSize:      pageSize,
	}
	client, err := New(config)
	require.NoError(t, err)
	return client
}

func generateSettingsJSON(settings []Setting, continueToken string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`{"apiVersion":"setting.grafana.app/v0alpha1","kind":"SettingList","metadata":{"continue":"%s"},"items":[`, continueToken))

	for i, s := range settings {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(fmt.Sprintf(
			`{"apiVersion":"setting.grafana.app/v0alpha1","kind":"Setting","metadata":{"name":"%s--%s","namespace":"test-namespace"},"spec":{"section":"%s","key":"%s","value":"%s"}}`,
			s.Section, s.Key, s.Section, s.Key, s.Value,
		))
	}

	sb.WriteString(`]}`)
	return sb.String()
}

// Benchmark tests for streaming JSON parser

func BenchmarkParseSettingList(b *testing.B) {
	jsonData := generateSettingListJSON(4000, 100)
	jsonBytes := []byte(jsonData)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		reader := bytes.NewReader(jsonBytes)
		_, _, _ = parseSettingList(reader)
	}
}

func BenchmarkParseSettingList_SinglePage(b *testing.B) {
	jsonData := generateSettingListJSON(500, 50)
	jsonBytes := []byte(jsonData)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		reader := bytes.NewReader(jsonBytes)
		_, _, _ = parseSettingList(reader)
	}
}

// generateSettingListJSON generates a K8s-style SettingList JSON response for benchmarks
func generateSettingListJSON(totalSettings, numSections int) string {
	var sb strings.Builder
	sb.WriteString(`{"apiVersion":"setting.grafana.app/v0alpha1","kind":"SettingList","metadata":{"continue":""},"items":[`)

	settingsPerSection := totalSettings / numSections
	first := true
	for section := 0; section < numSections; section++ {
		for key := 0; key < settingsPerSection; key++ {
			if !first {
				sb.WriteString(",")
			}
			first = false
			sb.WriteString(fmt.Sprintf(
				`{"apiVersion":"setting.grafana.app/v0alpha1","kind":"Setting","metadata":{"name":"section-%03d--key-%03d","namespace":"bench-ns"},"spec":{"section":"section-%03d","key":"key-%03d","value":"value-for-section-%d-key-%d"}}`,
				section, key, section, key, section, key,
			))
		}
	}

	sb.WriteString(`]}`)
	return sb.String()
}

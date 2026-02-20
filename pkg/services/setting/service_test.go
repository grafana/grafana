package setting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/util/flowcontrol"
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
		assert.Equal(t, "server", result[0].Labels["section"])
		assert.Equal(t, "port", result[0].Labels["key"])
	})

	t.Run("should handle settings with custom labels", func(t *testing.T) {
		settings := []Setting{
			{
				Section: "database",
				Key:     "password",
				Value:   "",
				Labels: map[string]string{
					"isTest":   "true",
					"testName": "custom-labels",
				},
			},
		}
		server := newTestServer(t, settings, "")
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		result, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Len(t, result, 1)
		assert.Equal(t, "database", result[0].Labels["section"])
		assert.Equal(t, "password", result[0].Labels["key"])
		assert.Equal(t, "true", result[0].Labels["isTest"])
		assert.Equal(t, "custom-labels", result[0].Labels["testName"])
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

	t.Run("should set user-agent header on requests", func(t *testing.T) {
		var capturedUserAgent string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedUserAgent = r.Header.Get("User-Agent")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{}, "")))
		}))
		defer server.Close()

		client := newTestClient(t, server.URL, 500)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		_, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Contains(t, capturedUserAgent, "settings-client")
		assert.Contains(t, capturedUserAgent, apiVersion)
	})

	t.Run("should include custom service name in user-agent", func(t *testing.T) {
		var capturedUserAgent string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedUserAgent = r.Header.Get("User-Agent")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{}, "")))
		}))
		defer server.Close()

		config := Config{
			URL:           server.URL,
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			ServiceName:   "my-custom-service",
		}
		client, err := New(config)
		require.NoError(t, err)

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		_, err = client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Equal(t, fmt.Sprintf("settings-client %s (my-custom-service)", apiVersion), capturedUserAgent)
	})

	t.Run("should use OTEL_SERVICE_NAME env var when ServiceName is not set", func(t *testing.T) {
		t.Setenv(otelServiceNameEnvVar, "otel-test-service")

		var capturedUserAgent string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedUserAgent = r.Header.Get("User-Agent")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{}, "")))
		}))
		defer server.Close()

		config := Config{
			URL:           server.URL,
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}
		client, err := New(config)
		require.NoError(t, err)

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		_, err = client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Equal(t, fmt.Sprintf("settings-client %s (otel-test-service)", apiVersion), capturedUserAgent)
	})

	t.Run("should prefer Config.ServiceName over OTEL_SERVICE_NAME env var", func(t *testing.T) {
		t.Setenv(otelServiceNameEnvVar, "otel-test-service")

		var capturedUserAgent string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedUserAgent = r.Header.Get("User-Agent")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{}, "")))
		}))
		defer server.Close()

		config := Config{
			URL:           server.URL,
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			ServiceName:   "explicit-service",
		}
		client, err := New(config)
		require.NoError(t, err)

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		_, err = client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Equal(t, fmt.Sprintf("settings-client %s (explicit-service)", apiVersion), capturedUserAgent)
	})

	t.Run("should fall back to default when neither ServiceName nor env var is set", func(t *testing.T) {
		t.Setenv(otelServiceNameEnvVar, "")

		var capturedUserAgent string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedUserAgent = r.Header.Get("User-Agent")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{}, "")))
		}))
		defer server.Close()

		config := Config{
			URL:           server.URL,
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}
		client, err := New(config)
		require.NoError(t, err)

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		_, err = client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Equal(t, fmt.Sprintf("settings-client %s (grafana)", apiVersion), capturedUserAgent)
	})

	t.Run("should propagate trace context in requests", func(t *testing.T) {
		// Set up OpenTelemetry with W3C trace context propagator
		tp := sdktrace.NewTracerProvider()
		otel.SetTracerProvider(tp)
		otel.SetTextMapPropagator(propagation.TraceContext{})
		t.Cleanup(func() {
			_ = tp.Shutdown(context.Background())
		})

		var capturedTraceparent string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedTraceparent = r.Header.Get("Traceparent")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{}, "")))
		}))
		defer server.Close()

		client := newTestClient(t, server.URL, 500)

		// Create a context with a span
		tracer := otel.Tracer("test")
		ctx, span := tracer.Start(context.Background(), "test-list-operation")
		defer span.End()

		traceID := span.SpanContext().TraceID().String()
		ctx = request.WithNamespace(ctx, "test-namespace")

		_, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.NotEmpty(t, capturedTraceparent, "Traceparent header should be set")
		assert.Contains(t, capturedTraceparent, traceID, "Traceparent should contain the trace ID")
	})
}

func TestParseSettingList(t *testing.T) {
	t.Run("should parse valid settings list", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v1beta1",
			"kind": "SettingList",
			"metadata": {"continue": ""},
			"items": [
				{"spec": {"section": "database", "key": "type", "value": "postgres"}},
				{"spec": {"section": "server", "key": "port", "value": "3000"}}
			]
		}`

		settings, continueToken, err := parseSettingList(context.Background(), strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Len(t, settings, 2)
		assert.Equal(t, "", continueToken)
		assert.Equal(t, "database", settings[0].Section)
		assert.Equal(t, "type", settings[0].Key)
		assert.Equal(t, "postgres", settings[0].Value)
	})

	t.Run("should parse continue token", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v1beta1",
			"kind": "SettingList",
			"metadata": {"continue": "next-page-token"},
			"items": []
		}`

		_, continueToken, err := parseSettingList(context.Background(), strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Equal(t, "next-page-token", continueToken)
	})

	t.Run("should handle empty items", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v1beta1",
			"kind": "SettingList",
			"metadata": {},
			"items": []
		}`

		settings, _, err := parseSettingList(context.Background(), strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Len(t, settings, 0)
	})

	t.Run("should parse labels from metadata", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v1beta1",
			"kind": "SettingList",
			"metadata": {"continue": ""},
			"items": [
				{
					"metadata": {
						"name": "server--http-port",
						"namespace": "test-ns",
						"labels": {"section": "server", "key": "http_port"}
					},
					"spec": {"section": "server", "key": "http_port", "value": "3000"}
				},
				{
					"metadata": {
						"name": "database--type",
						"namespace": "test-ns",
						"labels": {"section": "database", "key": "type"}
					},
					"spec": {"section": "database", "key": "type", "value": "postgres"}
				}
			]
		}`

		settings, _, err := parseSettingList(context.Background(), strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Len(t, settings, 2)

		// Verify first setting labels
		assert.Equal(t, "server", settings[0].Labels["section"])
		assert.Equal(t, "http_port", settings[0].Labels["key"])

		// Verify second setting labels
		assert.Equal(t, "database", settings[1].Labels["section"])
		assert.Equal(t, "type", settings[1].Labels["key"])
	})

	t.Run("should handle items without labels", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v1beta1",
			"kind": "SettingList",
			"metadata": {"continue": ""},
			"items": [
				{
					"metadata": {"name": "server--port", "namespace": "test-ns"},
					"spec": {"section": "server", "key": "port", "value": "3000"}
				}
			]
		}`

		settings, _, err := parseSettingList(context.Background(), strings.NewReader(jsonData))

		require.NoError(t, err)
		assert.Len(t, settings, 1)
		assert.Nil(t, settings[0].Labels)
	})
}

func TestToIni(t *testing.T) {
	t.Run("should convert settings to ini format", func(t *testing.T) {
		settings := []*Setting{
			{Section: "database", Key: "type", Value: "postgres"},
			{Section: "database", Key: "host", Value: "localhost"},
			{Section: "server", Key: "http_port", Value: "3000"},
		}

		result, err := toIni(context.Background(), settings)

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

		result, err := toIni(context.Background(), settings)

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

		result, err := toIni(context.Background(), settings)

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

func TestListCache(t *testing.T) {
	t.Run("should return cached result on second call with same namespace and selector", func(t *testing.T) {
		var requestCount atomic.Int32
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
		}
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestCount.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(settings, "")))
		}))
		defer server.Close()

		client := newTestClientWithCache(t, server.URL, 500, 5*time.Second)
		ctx := request.WithNamespace(context.Background(), "test-namespace")
		selector := metav1.LabelSelector{}

		result1, err := client.List(ctx, selector)
		require.NoError(t, err)
		assert.Len(t, result1, 1)
		assert.Equal(t, int32(1), requestCount.Load())

		result2, err := client.List(ctx, selector)
		require.NoError(t, err)
		assert.Len(t, result2, 1)
		assert.Equal(t, int32(1), requestCount.Load(), "second call should hit cache, not the server")

		remoteClient := client.(*remoteSettingService)
		assert.Equal(t, float64(1), testutil.ToFloat64(remoteClient.metrics.cacheHitTotal))
	})

	t.Run("should miss cache for different selectors", func(t *testing.T) {
		var requestCount atomic.Int32
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
			{Section: "database", Key: "host", Value: "localhost"},
		}
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestCount.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(settings, "")))
		}))
		defer server.Close()

		client := newTestClientWithCache(t, server.URL, 500, 5*time.Second)
		ctx := request.WithNamespace(context.Background(), "test-namespace")

		_, err := client.List(ctx, metav1.LabelSelector{})
		require.NoError(t, err)
		assert.Equal(t, int32(1), requestCount.Load())

		_, err = client.List(ctx, metav1.LabelSelector{
			MatchLabels: map[string]string{"section": "server"},
		})
		require.NoError(t, err)
		assert.Equal(t, int32(2), requestCount.Load(), "different selector should miss cache")
	})

	t.Run("should miss cache for different namespaces", func(t *testing.T) {
		var requestCount atomic.Int32
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
		}
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestCount.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(settings, "")))
		}))
		defer server.Close()

		client := newTestClientWithCache(t, server.URL, 500, 5*time.Second)
		selector := metav1.LabelSelector{}

		ctx1 := request.WithNamespace(context.Background(), "namespace-a")
		_, err := client.List(ctx1, selector)
		require.NoError(t, err)
		assert.Equal(t, int32(1), requestCount.Load())

		ctx2 := request.WithNamespace(context.Background(), "namespace-b")
		_, err = client.List(ctx2, selector)
		require.NoError(t, err)
		assert.Equal(t, int32(2), requestCount.Load(), "different namespace should miss cache")
	})

	t.Run("should not cache when cache is disabled", func(t *testing.T) {
		var requestCount atomic.Int32
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
		}
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestCount.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(settings, "")))
		}))
		defer server.Close()

		config := Config{
			URL:           server.URL,
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			PageSize:      500,
			CacheTTL:      -1,
		}
		client, err := New(config)
		require.NoError(t, err)

		remoteClient := client.(*remoteSettingService)
		assert.Nil(t, remoteClient.cache, "cache should be nil when disabled")

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		selector := metav1.LabelSelector{}

		_, err = client.List(ctx, selector)
		require.NoError(t, err)
		assert.Equal(t, int32(1), requestCount.Load())

		_, err = client.List(ctx, selector)
		require.NoError(t, err)
		assert.Equal(t, int32(2), requestCount.Load(), "every call should hit server when cache disabled")
	})

	t.Run("should use default cache TTL when CacheTTL is zero", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}
		client, err := New(config)
		require.NoError(t, err)

		remoteClient := client.(*remoteSettingService)
		assert.NotNil(t, remoteClient.cache, "cache should be enabled by default")
		assert.NotNil(t, remoteClient.metrics.cacheHitTotal, "cacheHitTotal should be set when cache enabled")
	})

	t.Run("should not observe listResultSize on cache hit", func(t *testing.T) {
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
		}
		server := newTestServer(t, settings, "")
		defer server.Close()

		client := newTestClientWithCache(t, server.URL, 500, 5*time.Second)
		ctx := request.WithNamespace(context.Background(), "test-namespace")
		selector := metav1.LabelSelector{}

		remoteClient := client.(*remoteSettingService)

		// First call: actual fetch — expect 1 sample in histogram
		_, err := client.List(ctx, selector)
		require.NoError(t, err)
		countAfterFirst := testutil.CollectAndCount(remoteClient.metrics.listResultSize)

		// Second call: cache hit — sample count must not increase
		_, err = client.List(ctx, selector)
		require.NoError(t, err)
		countAfterSecond := testutil.CollectAndCount(remoteClient.metrics.listResultSize)

		assert.Equal(t, countAfterFirst, countAfterSecond, "listResultSize should not be observed on cache hit")
	})

	t.Run("should serialize concurrent fetches for the same cache key", func(t *testing.T) {
		var concurrentMax atomic.Int32
		var concurrent atomic.Int32
		settings := []Setting{
			{Section: "server", Key: "port", Value: "3000"},
		}
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cur := concurrent.Add(1)
			for {
				old := concurrentMax.Load()
				if cur <= old || concurrentMax.CompareAndSwap(old, cur) {
					break
				}
			}
			time.Sleep(50 * time.Millisecond)
			concurrent.Add(-1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(settings, "")))
		}))
		defer server.Close()

		// Use very short TTL so the cache expires between requests
		client := newTestClientWithCache(t, server.URL, 500, 10*time.Millisecond)

		done := make(chan struct{})
		selector := metav1.LabelSelector{}
		count := 5
		for range count {
			go func() {
				ctx := request.WithNamespace(context.Background(), "same-namespace")
				_, _ = client.List(ctx, selector)
				done <- struct{}{}
			}()
		}
		for range count {
			<-done
		}

		assert.Equal(t, int32(1), concurrentMax.Load(), "only one concurrent request per cache key should be allowed")
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
		CacheTTL:      -1, // disable cache for existing tests
	}
	client, err := New(config)
	require.NoError(t, err)
	return client
}

func newTestClientWithCache(t *testing.T, serverURL string, pageSize int64, cacheTTL time.Duration) Service {
	t.Helper()
	config := Config{
		URL:           serverURL,
		WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		PageSize:      pageSize,
		CacheTTL:      cacheTTL,
	}
	client, err := New(config)
	require.NoError(t, err)
	return client
}

func generateSettingsJSON(settings []Setting, continueToken string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`{"apiVersion":"setting.grafana.app/v1beta1","kind":"SettingList","metadata":{"continue":"%s"},"items":[`, continueToken))

	for i, s := range settings {
		if i > 0 {
			sb.WriteString(",")
		}
		// Generate labels - always include section/key, merge with any custom labels
		labels := map[string]string{"section": s.Section, "key": s.Key}
		for k, v := range s.Labels {
			labels[k] = v
		}
		labelsJSON, _ := json.Marshal(labels)
		sb.WriteString(fmt.Sprintf(
			`{"apiVersion":"setting.grafana.app/v1beta1","kind":"Setting","metadata":{"name":"%s--%s","namespace":"test-namespace","labels":%s},"spec":{"section":"%s","key":"%s","value":"%s"}}`,
			s.Section, s.Key, labelsJSON, s.Section, s.Key, s.Value,
		))
	}

	sb.WriteString(`]}`)
	return sb.String()
}

func TestInstrumentedRateLimiter(t *testing.T) {
	t.Run("should increment counter when Wait blocks beyond threshold", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			counter := prometheus.NewCounter(prometheus.CounterOpts{
				Name: "test_throttle_total",
			})

			// QPS=1 and Burst=1: first call passes immediately, second must wait ~1s
			rl := &instrumentedRateLimiter{
				RateLimiter: flowcontrol.NewTokenBucketRateLimiter(1, 1),
				waitCounter: counter,
			}

			ctx := t.Context()

			// First Wait should not block (burst token available)
			require.NoError(t, rl.Wait(ctx))
			assert.Equal(t, float64(0), testutil.ToFloat64(counter))

			// Second Wait blocks; synctest advances fake time past the token refill
			require.NoError(t, rl.Wait(ctx))
			assert.Equal(t, float64(1), testutil.ToFloat64(counter))
		})
	})

	t.Run("should not increment counter when Wait is fast", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			counter := prometheus.NewCounter(prometheus.CounterOpts{
				Name: "test_throttle_total_fast",
			})

			// High QPS so Wait never blocks significantly
			rl := &instrumentedRateLimiter{
				RateLimiter: flowcontrol.NewTokenBucketRateLimiter(1000, 100),
				waitCounter: counter,
			}

			ctx := t.Context()
			for range 10 {
				require.NoError(t, rl.Wait(ctx))
			}
			assert.Equal(t, float64(0), testutil.ToFloat64(counter))
		})
	})
}

// Benchmark tests for streaming JSON parser

func BenchmarkParseSettingList(b *testing.B) {
	jsonData := generateSettingListJSON(4000, 100)
	jsonBytes := []byte(jsonData)

	b.ResetTimer()
	b.ReportAllocs()

	for b.Loop() {
		reader := bytes.NewReader(jsonBytes)
		_, _, _ = parseSettingList(context.Background(), reader)
	}
}

func BenchmarkParseSettingList_SinglePage(b *testing.B) {
	jsonData := generateSettingListJSON(500, 50)
	jsonBytes := []byte(jsonData)

	b.ResetTimer()
	b.ReportAllocs()
	for b.Loop() {
		reader := bytes.NewReader(jsonBytes)
		_, _, _ = parseSettingList(context.Background(), reader)
	}
}

// generateSettingListJSON generates a K8s-style SettingList JSON response for benchmarks
func generateSettingListJSON(totalSettings, numSections int) string {
	var sb strings.Builder
	sb.WriteString(`{"apiVersion":"setting.grafana.app/v1beta1","kind":"SettingList","metadata":{"continue":""},"items":[`)

	settingsPerSection := totalSettings / numSections
	first := true
	for section := 0; section < numSections; section++ {
		for key := 0; key < settingsPerSection; key++ {
			if !first {
				sb.WriteString(",")
			}
			first = false
			sb.WriteString(fmt.Sprintf(
				`{"apiVersion":"setting.grafana.app/v1beta1","kind":"Setting","metadata":{"name":"section-%03d--key-%03d","namespace":"bench-ns","labels":{"section":"section-%03d","key":"key-%03d"}},"spec":{"section":"section-%03d","key":"key-%03d","value":"value-for-section-%d-key-%d"}}`,
				section, key, section, key, section, key, section, key,
			))
		}
	}

	sb.WriteString(`]}`)
	return sb.String()
}

package setting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
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
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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
		assert.Contains(t, err.Error(), "not found")
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
		// Now decodes the server's Status message instead of a generic one.
		assert.Contains(t, err.Error(), "database connection failed")
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

func TestListWithFieldSelector(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "source=us", r.URL.Query().Get("labelSelector"))
		assert.Equal(t, "metadata.namespace=test-namespace", r.URL.Query().Get("fieldSelector"))
		assert.Equal(t, "1", r.URL.Query().Get("limit"))
		w.Header().Set("Content-Type", "application/json")
		if requests.Add(1) == 1 {
			assert.Empty(t, r.URL.Query().Get("continue"))
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{{Section: "auditing", Key: "enabled", Value: "true"}}, "next")))
		} else {
			assert.Equal(t, "next", r.URL.Query().Get("continue"))
			_, _ = w.Write([]byte(generateSettingsJSON([]Setting{{Section: "auditing", Key: "api_groups_allowlist", Value: "core"}}, "")))
		}
	}))
	t.Cleanup(server.Close)
	client := newTestClient(t, server.URL, 1)
	ctx := request.WithNamespace(t.Context(), "test-namespace")
	result, err := client.ListAsIniWithFieldSelector(ctx, metav1.LabelSelector{MatchLabels: map[string]string{"source": "us"}}, fields.OneTermEqualSelector("metadata.namespace", "test-namespace"))
	require.NoError(t, err)
	require.Equal(t, "true", result.Section("auditing").Key("enabled").String())
	require.Equal(t, "core", result.Section("auditing").Key("api_groups_allowlist").String())
	require.Equal(t, int32(2), requests.Load())
}

func TestFieldSelectorCache(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		settings := []Setting{{Section: "auditing", Key: "enabled", Value: "true"}}
		switch r.URL.Query().Get("fieldSelector") {
		case "":
			settings = append(settings, Setting{Section: "auditing.logs.loki", Key: "url", Value: "loki:3100"})
		case "metadata.name=auditing--enabled":
		case "metadata.name=missing":
			settings = nil
		default:
			t.Errorf("unexpected field selector: %s", r.URL.Query().Get("fieldSelector"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(generateSettingsJSON(settings, "")))
	}))
	t.Cleanup(server.Close)
	client := newTestClientWithCache(t, server.URL, 500, time.Hour)
	ctx := request.WithNamespace(t.Context(), "test-namespace")
	selector := metav1.LabelSelector{MatchLabels: map[string]string{"source": "us"}}
	enabled := fields.OneTermEqualSelector("metadata.name", "auditing--enabled")
	missing := fields.OneTermEqualSelector("metadata.name", "missing")

	for range 2 {
		result, err := client.ListWithFieldSelector(ctx, selector, enabled)
		require.NoError(t, err)
		require.Len(t, result, 1)
		result, err = client.List(ctx, selector)
		require.NoError(t, err)
		require.Len(t, result, 2)
		result, err = client.ListWithFieldSelector(ctx, selector, missing)
		require.NoError(t, err)
		require.Empty(t, result)
	}
	require.Equal(t, int32(3), requests.Load())

	result, err := client.ListAsIniWithFieldSelector(ctx, selector, enabled)
	require.NoError(t, err)
	require.True(t, result.Section("auditing").Key("enabled").MustBool())
	for _, fieldSelector := range []fields.Selector{nil, fields.Everything()} {
		result, err := client.ListWithFieldSelector(ctx, selector, fieldSelector)
		require.NoError(t, err)
		require.Len(t, result, 2)
	}
	require.Equal(t, int32(3), requests.Load())

	_, err = client.ListWithFieldSelector(ctx, metav1.LabelSelector{}, enabled)
	require.NoError(t, err)
	_, err = client.ListWithFieldSelector(request.WithNamespace(t.Context(), "another-namespace"), selector, enabled)
	require.NoError(t, err)
	require.Equal(t, int32(5), requests.Load())
}

func TestFieldSelectorErrorsAreNotCached(t *testing.T) {
	for _, code := range []int{http.StatusForbidden, http.StatusInternalServerError} {
		t.Run(http.StatusText(code), func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if requests.Add(1) == 1 {
					w.WriteHeader(code)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(generateSettingsJSON([]Setting{{Section: "auditing", Key: "enabled", Value: "true"}}, "")))
			}))
			t.Cleanup(server.Close)
			client := newTestClientWithCache(t, server.URL, 500, time.Hour)
			ctx := request.WithNamespace(t.Context(), "test-namespace")
			selector := fields.OneTermEqualSelector("metadata.name", "auditing--enabled")
			_, err := client.ListWithFieldSelector(ctx, metav1.LabelSelector{}, selector)
			require.Error(t, err)
			result, err := client.ListWithFieldSelector(ctx, metav1.LabelSelector{}, selector)
			require.NoError(t, err)
			require.Len(t, result, 1)
			require.Equal(t, int32(2), requests.Load())
		})
	}
}

func TestFieldSelectorConcurrentFetches(t *testing.T) {
	entered := make(chan string, 2)
	release := make(chan struct{})
	unblock := sync.OnceFunc(func() { close(release) })
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		selector := r.URL.Query().Get("fieldSelector")
		select {
		case entered <- selector:
		default:
		}
		<-release
		section := "auditing"
		if selector == "metadata.name=analytics--enabled" {
			section = "analytics"
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(generateSettingsJSON([]Setting{{Section: section, Key: "enabled", Value: "true"}}, "")))
	}))
	t.Cleanup(server.Close)
	t.Cleanup(unblock)
	client := newTestClientWithCache(t, server.URL, 500, time.Hour)
	ctx := request.WithNamespace(t.Context(), "test-namespace")
	type result struct {
		section  string
		settings []*Setting
		err      error
	}
	results := make(chan result, 20)
	var wg sync.WaitGroup
	for _, section := range []string{"auditing", "analytics"} {
		for range 10 {
			wg.Go(func() {
				settings, err := client.ListWithFieldSelector(ctx, metav1.LabelSelector{}, fields.OneTermEqualSelector("metadata.name", section+"--enabled"))
				results <- result{section: section, settings: settings, err: err}
			})
		}
	}
	seen := map[string]bool{}
	for range 2 {
		select {
		case selector := <-entered:
			seen[selector] = true
		case <-time.After(5 * time.Second):
			t.Fatal("different field selectors should fetch independently")
		}
	}
	require.Len(t, seen, 2)
	unblock()
	wg.Wait()
	close(results)
	for result := range results {
		require.NoError(t, result.err)
		require.Len(t, result.settings, 1)
		require.Equal(t, result.section, result.settings[0].Section)
	}
	require.Equal(t, int32(2), requests.Load())
}

func TestParseSettingList(t *testing.T) {
	t.Run("should parse valid settings list", func(t *testing.T) {
		jsonData := `{
			"apiVersion": "setting.grafana.app/v1",
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
			"apiVersion": "setting.grafana.app/v1",
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
			"apiVersion": "setting.grafana.app/v1",
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
			"apiVersion": "setting.grafana.app/v1",
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
			"apiVersion": "setting.grafana.app/v1",
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
		assert.Equal(t, float64(1), testutil.ToFloat64(remoteClient.metrics.cacheMissTotal))
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
		assert.NotNil(t, remoteClient.metrics.cacheMissTotal, "cacheMissTotal should be set when cache enabled")
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

func newTestClient(t *testing.T, serverURL string, pageSize int64) FieldSelectorService {
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

func newTestClientWithCache(t *testing.T, serverURL string, pageSize int64, cacheTTL time.Duration) FieldSelectorService {
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
	sb.WriteString(fmt.Sprintf(`{"apiVersion":"setting.grafana.app/v1","kind":"SettingList","metadata":{"continue":"%s"},"items":[`, continueToken))

	for i, s := range settings {
		if i > 0 {
			sb.WriteString(",")
		}
		// Generate labels - always include section/key, merge with any custom labels
		labels := map[string]string{"section": s.Section, "key": s.Key}
		maps.Copy(labels, s.Labels)
		labelsJSON, _ := json.Marshal(labels)
		sb.WriteString(fmt.Sprintf(
			`{"apiVersion":"setting.grafana.app/v1","kind":"Setting","metadata":{"name":"%s--%s","namespace":"test-namespace","labels":%s},"spec":{"section":"%s","key":"%s","value":"%s"}}`,
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
	sb.WriteString(`{"apiVersion":"setting.grafana.app/v1","kind":"SettingList","metadata":{"continue":""},"items":[`)

	settingsPerSection := totalSettings / numSections
	first := true
	for section := range numSections {
		for key := range settingsPerSection {
			if !first {
				sb.WriteString(",")
			}
			first = false
			sb.WriteString(fmt.Sprintf(
				`{"apiVersion":"setting.grafana.app/v1","kind":"Setting","metadata":{"name":"section-%03d--key-%03d","namespace":"bench-ns","labels":{"section":"section-%03d","key":"key-%03d"}},"spec":{"section":"section-%03d","key":"key-%03d","value":"value-for-section-%d-key-%d"}}`,
				section, key, section, key, section, key, section, key,
			))
		}
	}

	sb.WriteString(`]}`)
	return sb.String()
}

type fakeSubscriber struct {
	enabled     bool
	err         error
	subject     string
	handler     func(subject string, data []byte)
	onReconnect func()
}

func (f *fakeSubscriber) Enabled() bool { return f.enabled }

func (f *fakeSubscriber) Subscribe(_ context.Context, subject string, handler func(string, []byte), onReconnect func()) error {
	if f.err != nil {
		return f.err
	}
	f.subject, f.handler, f.onReconnect = subject, handler, onReconnect
	return nil
}

func (f *fakeSubscriber) publish(t *testing.T, namespace string) {
	t.Helper()
	data, err := proto.Marshal(&resourcepb.WatchNotification{Namespace: namespace, Name: "server--port"})
	require.NoError(t, err)
	f.handler(f.subject, data)
}

func newEventTestClient(t *testing.T, server *httptest.Server, sub EventSubscriber, ttl time.Duration) *remoteSettingService {
	t.Helper()
	client, err := New(Config{
		URL:             server.URL,
		WrapTransport:   func(rt http.RoundTripper) http.RoundTripper { return rt },
		CacheTTL:        ttl,
		EventSubscriber: sub,
	})
	require.NoError(t, err)
	return client.(*remoteSettingService)
}

func invalidations(c *remoteSettingService, reason string) float64 {
	return testutil.ToFloat64(c.metrics.cacheInvalidationTotal.WithLabelValues(reason))
}

func countingServer(t *testing.T, requests *atomic.Int32) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(generateSettingsJSON([]Setting{{Section: "server", Key: "port", Value: "3000"}}, "")))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestListCacheInvalidationEvents(t *testing.T) {
	list := func(t *testing.T, c *remoteSettingService, ns string) {
		t.Helper()
		_, err := c.List(request.WithNamespace(context.Background(), ns), metav1.LabelSelector{})
		require.NoError(t, err)
	}

	t.Run("event evicts only the affected namespace", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)
		assert.Equal(t, "us.watch.v1.setting.grafana.app.*.settings", sub.subject)

		for _, ns := range []string{"stacks-1", "stacks-2", "stacks-3"} {
			list(t, c, ns)
		}
		require.Equal(t, int32(3), requests.Load())

		sub.publish(t, "stacks-1")

		list(t, c, "stacks-2")
		list(t, c, "stacks-3")
		assert.Equal(t, int32(3), requests.Load(), "unaffected namespaces stay cached")
		list(t, c, "stacks-1")
		assert.Equal(t, int32(4), requests.Load(), "affected namespace is refetched")
		assert.Equal(t, float64(1), invalidations(c, invalidationReasonEvent))
		assert.Equal(t, float64(0), invalidations(c, invalidationReasonReconnect)+invalidations(c, invalidationReasonInvalidEvent))
		assert.Equal(t, float64(1), testutil.ToFloat64(c.metrics.cacheSubscribed))
	})

	namespaces := []string{"stacks-1", "stacks-2", "stacks-3"}

	// flushesAll warms every namespace, triggers the event, then expects all of them to be refetched.
	flushesAll := func(t *testing.T, reason string, trigger func(sub *fakeSubscriber)) {
		t.Helper()
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)

		for _, ns := range namespaces {
			list(t, c, ns)
		}
		require.Equal(t, int32(len(namespaces)), requests.Load(), "warm-up fetches each namespace once")
		for _, ns := range namespaces {
			list(t, c, ns)
		}
		require.Equal(t, int32(len(namespaces)), requests.Load(), "all namespaces are served from the cache")

		trigger(sub)

		for _, ns := range namespaces {
			list(t, c, ns)
		}
		assert.Equal(t, int32(2*len(namespaces)), requests.Load(), "every namespace is refetched")
		assert.Equal(t, float64(1), invalidations(c, reason))
		assert.Equal(t, float64(0), invalidations(c, invalidationReasonEvent), "not counted as a single-namespace event")
	}

	t.Run("all namespaces are flushed on reconnect", func(t *testing.T) {
		flushesAll(t, invalidationReasonReconnect, func(sub *fakeSubscriber) { sub.onReconnect() })
	})

	t.Run("all namespaces are flushed on an undecodable event", func(t *testing.T) {
		flushesAll(t, invalidationReasonInvalidEvent, func(sub *fakeSubscriber) { sub.handler(sub.subject, []byte("not a proto")) })
	})

	t.Run("all namespaces are flushed on an event without a namespace", func(t *testing.T) {
		flushesAll(t, invalidationReasonInvalidEvent, func(sub *fakeSubscriber) { sub.publish(t, "") })
	})

	t.Run("event during a fetch keeps the stale result out of the cache", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		inFetch := make(chan struct{})
		release := make(chan struct{})
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			if requests.Add(1) == 1 {
				close(inFetch)
				<-release
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(nil, "")))
		}))
		t.Cleanup(server.Close)
		c := newEventTestClient(t, server, sub, 0)

		done := make(chan struct{})
		go func() {
			defer close(done)
			list(t, c, "stacks-1")
		}()
		<-inFetch
		sub.publish(t, "stacks-1")
		close(release)
		<-done

		list(t, c, "stacks-1")
		assert.Equal(t, int32(2), requests.Load())
	})

	t.Run("subscribe failure falls back to TTL caching", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true, err: errors.New("nats down")}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)

		list(t, c, "stacks-1")
		list(t, c, "stacks-1")

		assert.Equal(t, int32(1), requests.Load())
		assert.Equal(t, float64(0), testutil.ToFloat64(c.metrics.cacheSubscribed))
	})

	t.Run("disabled subscriber is not used", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: false}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)

		assert.Nil(t, sub.handler)
		list(t, c, "stacks-1")
		list(t, c, "stacks-1")
		assert.Equal(t, int32(1), requests.Load())
	})

	t.Run("caching disabled never subscribes", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		newEventTestClient(t, countingServer(t, &requests), sub, -1)

		assert.Nil(t, sub.handler)
	})
}

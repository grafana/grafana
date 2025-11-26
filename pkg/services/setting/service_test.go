package setting

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"

	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/infra/log"
)

func TestRemoteSettingService_ListAsIni(t *testing.T) {
	t.Run("should filter settings by label selector", func(t *testing.T) {
		// Create multiple settings, only some matching the selector
		setting1 := newUnstructuredSetting("test-namespace", Setting{Section: "database", Key: "type", Value: "postgres"})
		setting2 := newUnstructuredSetting("test-namespace", Setting{Section: "server", Key: "port", Value: "3000"})
		setting3 := newUnstructuredSetting("test-namespace", Setting{Section: "database", Key: "host", Value: "localhost"})

		client := newTestClient(500, setting1, setting2, setting3)

		// Create a selector that should match only database settings
		selector := metav1.LabelSelector{
			MatchLabels: map[string]string{
				"section": "database",
			},
		}

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		result, err := client.ListAsIni(ctx, selector)

		require.NoError(t, err)
		assert.NotNil(t, result)
		// Should only have database settings, not server settings
		assert.True(t, result.HasSection("database"))
		assert.Equal(t, "postgres", result.Section("database").Key("type").String())
		assert.Equal(t, "localhost", result.Section("database").Key("host").String())
		// Should NOT have server settings
		assert.False(t, result.HasSection("server"))
	})

	t.Run("should return all settings with empty selector", func(t *testing.T) {
		// Create multiple settings across different sections
		setting1 := newUnstructuredSetting("test-namespace", Setting{Section: "server", Key: "port", Value: "3000"})
		setting2 := newUnstructuredSetting("test-namespace", Setting{Section: "database", Key: "type", Value: "mysql"})

		client := newTestClient(500, setting1, setting2)

		// Empty selector should select everything
		selector := metav1.LabelSelector{}

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		result, err := client.ListAsIni(ctx, selector)

		require.NoError(t, err)
		assert.NotNil(t, result)
		// Should have all settings from all sections
		assert.True(t, result.HasSection("server"))
		assert.Equal(t, "3000", result.Section("server").Key("port").String())
		assert.True(t, result.HasSection("database"))
		assert.Equal(t, "mysql", result.Section("database").Key("type").String())
	})
}

func TestRemoteSettingService_List(t *testing.T) {
	t.Run("should handle single page response", func(t *testing.T) {
		setting := newUnstructuredSetting("test-namespace", Setting{Section: "server", Key: "port", Value: "3000"})

		client := newTestClient(500, setting)

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		result, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Len(t, result, 1)

		spec := result[0]
		assert.Equal(t, "server", spec.Section)
		assert.Equal(t, "port", spec.Key)
		assert.Equal(t, "3000", spec.Value)
	})

	t.Run("should handle multiple pages", func(t *testing.T) {
		totalPages := 3
		pageSize := 5

		pages := make([][]*unstructured.Unstructured, totalPages)
		for pageNum := 0; pageNum < totalPages; pageNum++ {
			for idx := 0; idx < pageSize; idx++ {
				item := newUnstructuredSetting(
					"test-namespace",
					Setting{
						Section: fmt.Sprintf("section-%d", pageNum),
						Key:     fmt.Sprintf("key-%d", idx),
						Value:   fmt.Sprintf("val-%d-%d", pageNum, idx),
					},
				)
				pages[pageNum] = append(pages[pageNum], item)
			}
		}

		scheme := runtime.NewScheme()
		dynamicClient := fake.NewSimpleDynamicClientWithCustomListKinds(scheme, settingGroupListKind)
		listCallCount := 0
		dynamicClient.PrependReactor("list", "settings", func(action k8testing.Action) (handled bool, ret runtime.Object, err error) {
			listCallCount++

			continueToken := fmt.Sprintf("continue-%d", listCallCount)
			if listCallCount == totalPages {
				continueToken = ""
			}

			if listCallCount <= totalPages {
				list := &unstructured.UnstructuredList{
					Object: map[string]interface{}{
						"apiVersion": ApiGroup + "/" + apiVersion,
						"kind":       listKind,
					},
				}
				list.SetContinue(continueToken)
				for _, item := range pages[listCallCount-1] {
					list.Items = append(list.Items, *item)
				}
				return true, list, nil
			}

			return false, nil, nil
		})

		client := &remoteSettingService{
			dynamicClient: dynamicClient,
			pageSize:      int64(pageSize),
			log:           log.NewNopLogger(),
			metrics:       initMetrics(),
		}

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		result, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Len(t, result, totalPages*pageSize)
		assert.Equal(t, totalPages, listCallCount)
	})

	t.Run("should pass label selector when provided", func(t *testing.T) {
		scheme := runtime.NewScheme()
		dynamicClient := fake.NewSimpleDynamicClientWithCustomListKinds(scheme, settingGroupListKind)
		dynamicClient.PrependReactor("list", "settings", func(action k8testing.Action) (handled bool, ret runtime.Object, err error) {
			listAction := action.(k8testing.ListActionImpl)
			assert.Equal(t, "app=grafana", listAction.ListOptions.LabelSelector)
			return true, &unstructured.UnstructuredList{}, nil
		})

		client := &remoteSettingService{
			dynamicClient: dynamicClient,
			pageSize:      500,
			log:           log.NewNopLogger(),
			metrics:       initMetrics(),
		}

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		_, err := client.List(ctx, metav1.LabelSelector{MatchLabels: map[string]string{"app": "grafana"}})

		require.NoError(t, err)
	})

	t.Run("should stop pagination at 1000 pages", func(t *testing.T) {
		scheme := runtime.NewScheme()
		dynamicClient := fake.NewSimpleDynamicClientWithCustomListKinds(scheme, settingGroupListKind)
		listCallCount := 0
		dynamicClient.PrependReactor("list", "settings", func(action k8testing.Action) (handled bool, ret runtime.Object, err error) {
			listCallCount++
			// Always return a continue token to simulate infinite pagination
			list := &unstructured.UnstructuredList{}
			list.SetContinue("continue-forever")
			return true, list, nil
		})

		client := &remoteSettingService{
			dynamicClient: dynamicClient,
			pageSize:      10,
			log:           log.NewNopLogger(),
			metrics:       initMetrics(),
		}

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		_, err := client.List(ctx, metav1.LabelSelector{})

		require.NoError(t, err)
		assert.Equal(t, 1000, listCallCount, "Should stop at 1000 pages to prevent infinite loops")
	})

	t.Run("should return error when parsing setting fails", func(t *testing.T) {
		scheme := runtime.NewScheme()
		dynamicClient := fake.NewSimpleDynamicClientWithCustomListKinds(scheme, settingGroupListKind)
		dynamicClient.PrependReactor("list", "settings", func(action k8testing.Action) (handled bool, ret runtime.Object, err error) {
			// Return a malformed setting without spec
			list := &unstructured.UnstructuredList{
				Object: map[string]interface{}{
					"apiVersion": ApiGroup + "/" + apiVersion,
					"kind":       listKind,
				},
			}
			malformedSetting := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": ApiGroup + "/" + apiVersion,
					"kind":       kind,
					"metadata": map[string]interface{}{
						"name":      "malformed",
						"namespace": "test-namespace",
					},
					// Missing spec
				},
			}
			list.Items = append(list.Items, *malformedSetting)
			return true, list, nil
		})

		client := &remoteSettingService{
			dynamicClient: dynamicClient,
			pageSize:      500,
			log:           log.NewNopLogger(),
			metrics:       initMetrics(),
		}

		ctx := request.WithNamespace(context.Background(), "test-namespace")
		result, err := client.List(ctx, metav1.LabelSelector{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "spec not found")
	})
}

func TestParseSettingResource(t *testing.T) {
	t.Run("should parse valid setting resource", func(t *testing.T) {
		setting := newUnstructuredSetting("test-namespace", Setting{Section: "database", Key: "type", Value: "postgres"})

		result, err := parseSettingResource(setting)

		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "database", result.Section)
		assert.Equal(t, "type", result.Key)
		assert.Equal(t, "postgres", result.Value)
	})

	t.Run("should return error when spec is missing", func(t *testing.T) {
		setting := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": ApiGroup + "/" + apiVersion,
				"kind":       kind,
				"metadata": map[string]interface{}{
					"name":      "test-setting",
					"namespace": "test-namespace",
				},
				// No spec
			},
		}

		result, err := parseSettingResource(setting)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "spec not found")
	})
}

func TestRemoteSettingService_ToIni(t *testing.T) {
	t.Run("should convert settings to ini format", func(t *testing.T) {
		settings := []*Setting{
			{Section: "database", Key: "type", Value: "postgres"},
			{Section: "database", Key: "host", Value: "localhost"},
			{Section: "server", Key: "http_port", Value: "3000"},
		}

		client := &remoteSettingService{
			pageSize: 500,
			log:      log.NewNopLogger(),
		}

		result, err := client.toIni(settings)

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

		client := &remoteSettingService{
			pageSize: 500,
			log:      log.NewNopLogger(),
		}

		result, err := client.toIni(settings)

		require.NoError(t, err)
		assert.NotNil(t, result)
		sections := result.Sections()
		assert.Len(t, sections, 1) // Only default section
	})

	t.Run("should create section if it does not exist", func(t *testing.T) {
		settings := []*Setting{
			{Section: "new_section", Key: "new_key", Value: "new_value"},
		}

		client := &remoteSettingService{
			pageSize: 500,
			log:      log.NewNopLogger(),
		}

		result, err := client.toIni(settings)

		require.NoError(t, err)
		assert.True(t, result.HasSection("new_section"))
		assert.Equal(t, "new_value", result.Section("new_section").Key("new_key").String())
	})

	t.Run("should handle multiple keys in same section", func(t *testing.T) {
		settings := []*Setting{
			{Section: "auth", Key: "disable_login_form", Value: "false"},
			{Section: "auth", Key: "disable_signout_menu", Value: "true"},
		}

		client := &remoteSettingService{
			pageSize: 500,
			log:      log.NewNopLogger(),
		}

		result, err := client.toIni(settings)

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

	t.Run("should use default page size when zero is provided", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			PageSize:      0,
		}

		client, err := New(config)

		require.NoError(t, err)
		assert.NotNil(t, client)
		remoteClient := client.(*remoteSettingService)
		assert.Equal(t, DefaultPageSize, remoteClient.pageSize)
	})

	t.Run("should return error when config is invalid", func(t *testing.T) {
		config := Config{
			URL: "", // Invalid: empty URL
		}

		client, err := New(config)

		require.Error(t, err)
		assert.Nil(t, client)
		assert.Contains(t, err.Error(), "URL cannot be empty")
	})
}

func TestGetDynamicClient(t *testing.T) {
	logger := log.NewNopLogger()

	t.Run("should return error when SettingServiceURL is empty", func(t *testing.T) {
		config := Config{
			URL:           "",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}

		client, err := getDynamicClient(config, logger)

		require.Error(t, err)
		assert.Nil(t, client)
		assert.Contains(t, err.Error(), "URL cannot be empty")
	})

	t.Run("should return error when both TokenExchangeClient and WrapTransport are nil", func(t *testing.T) {
		config := Config{
			URL:                 "https://example.com",
			TokenExchangeClient: nil,
			WrapTransport:       nil,
		}

		client, err := getDynamicClient(config, logger)

		require.Error(t, err)
		assert.Nil(t, client)
		assert.Contains(t, err.Error(), "must set either TokenExchangeClient or WrapTransport")
	})

	t.Run("should create client with WrapTransport", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}

		client, err := getDynamicClient(config, logger)

		require.NoError(t, err)
		assert.NotNil(t, client)
	})

	t.Run("should not fail when QPS and Burst are not provided", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
		}

		client, err := getDynamicClient(config, logger)

		require.NoError(t, err)
		assert.NotNil(t, client)
	})

	t.Run("should not fail when custom QPS and Burst are provided", func(t *testing.T) {
		config := Config{
			URL:           "https://example.com",
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper { return rt },
			QPS:           10.0,
			Burst:         20,
		}

		client, err := getDynamicClient(config, logger)

		require.NoError(t, err)
		assert.NotNil(t, client)
	})

	t.Run("should use WrapTransport when both WrapTransport and TokenExchangeClient are provided", func(t *testing.T) {
		wrapTransportCalled := false
		tokenExchangeClient := &authlib.TokenExchangeClient{}

		config := Config{
			URL:                 "https://example.com",
			TokenExchangeClient: tokenExchangeClient,
			WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
				wrapTransportCalled = true
				return rt
			},
		}

		client, err := getDynamicClient(config, logger)

		require.NoError(t, err)
		assert.NotNil(t, client)
		assert.True(t, wrapTransportCalled, "WrapTransport should be called and take precedence over TokenExchangeClient")
	})
}

// Helper function to create an unstructured Setting object for tests
func newUnstructuredSetting(namespace string, spec Setting) *unstructured.Unstructured {
	// Generate resource name in the format {section}--{key}
	name := fmt.Sprintf("%s--%s", spec.Section, spec.Key)

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": ApiGroup + "/" + apiVersion,
			"kind":       kind,
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"section": spec.Section,
				"key":     spec.Key,
				"value":   spec.Value,
			},
		},
	}
	// Always set section and key labels
	obj.SetLabels(map[string]string{
		"section": spec.Section,
		"key":     spec.Key,
	})
	return obj
}

// Helper function to create a test client with the dynamic fake client
func newTestClient(pageSize int64, objects ...runtime.Object) *remoteSettingService {
	scheme := runtime.NewScheme()
	dynamicClient := fake.NewSimpleDynamicClientWithCustomListKinds(scheme, settingGroupListKind, objects...)

	return &remoteSettingService{
		dynamicClient: dynamicClient,
		pageSize:      pageSize,
		log:           log.NewNopLogger(),
		metrics:       initMetrics(),
	}
}

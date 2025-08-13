package shorturl

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/dtos"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = schema.GroupVersionResource{
	Group:    "shorturl.grafana.app",
	Version:  "v1alpha1",
	Resource: "shorturls",
}

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationShortURL(t *testing.T) {
	t.Skip("Skipping due to issue with https://github.com/grafana/grafana/pull/109267")

	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("default setup with k8s flag turned off (legacy APIs)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true, // do not start extra port 6443
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{}, // legacy APIs only
		})
		// In this setup, K8s APIs are not available - legacy APIs only
		doLegacyOnlyTests(t, helper)

		// When no feature toggles are enabled, shortURL K8s APIs should not be available
		disco := helper.NewDiscoveryClient()
		groups, err := disco.ServerGroups()
		require.NoError(t, err)

		hasShortURLGroup := false
		for _, group := range groups.Groups {
			if group.Name == "shorturl.grafana.app" {
				hasShortURLGroup = true
				break
			}
		}
		require.False(t, hasShortURLGroup, "shortURL K8s APIs should not be available when kubernetesShortURLs feature toggle is disabled")
	})

	t.Run("with dual write (unified storage, mode 0)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		})
		doLegacyOnlyTests(t, helper)
	})

	t.Run("with dual write (unified storage, mode 1)", func(t *testing.T) {
		mode := grafanarest.Mode1
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: mode,
				},
			},
		})
		doDualWriteTests(t, helper, mode)
	})

	t.Run("with dual write (unified storage, mode 2)", func(t *testing.T) {
		mode := grafanarest.Mode2
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: mode,
				},
			},
		})
		doDualWriteTests(t, helper, mode)
	})

	t.Run("with dual write (unified storage, mode 3)", func(t *testing.T) {
		mode := grafanarest.Mode3
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: mode,
				},
			},
		})
		doDualWriteTests(t, helper, mode)
	})

	t.Run("with dual write (unified storage, mode 5)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
				},
			},
		})
		doUnifiedOnlyTests(t, helper)
	})
}

// doLegacyOnlyTests tests functionality for Mode 0 (legacy only)
// Only legacy API should be used, no K8s API interaction
func doLegacyOnlyTests(t *testing.T, helper *apis.K8sTestHelper) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Editor,
		GVR:  gvr,
	})

	t.Run("Legacy API CRUD", func(t *testing.T) {
		// Create via legacy API
		legacyPayload := `{
			"path": "d/xCmMwXdVz/legacy-only-test"
		}`
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   []byte(legacyPayload),
		}, &dtos.ShortURL{})
		require.NotNil(t, legacyCreate.Result)
		uid := legacyCreate.Result.UID
		require.NotEmpty(t, uid)

		// Read via legacy API
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/short-urls/" + uid,
		}, &shorturls.ShortUrl{})
		require.NotNil(t, legacyGet.Result)
		assert.Equal(t, uid, legacyGet.Result.Uid)
		assert.Equal(t, "d/xCmMwXdVz/legacy-only-test", legacyGet.Result.Path)
	})

	t.Run("Legacy API redirect functionality", func(t *testing.T) {
		// Create via legacy API
		legacyPayload := `{
			"path": "d/test/legacy-redirect"
		}`
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   []byte(legacyPayload),
		}, &dtos.ShortURL{})
		require.NotNil(t, legacyCreate.Result)
		uid := legacyCreate.Result.UID

		// Test redirect functionality
		redirectResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/goto/" + uid + "?orgId=default",
		}, (*interface{})(nil))
		assert.Equal(t, 302, redirectResponse.Response.StatusCode)
	})
}

// doDualWriteTests tests functionality for Modes 1-3 (dual write modes)
// Both APIs available with cross-API visibility
func doDualWriteTests(t *testing.T, helper *apis.K8sTestHelper, mode grafanarest.DualWriterMode) {
	// Check if shortURL K8s APIs are available
	hasShortURLAPI := checkShortURLAPIAvailable(t, helper)
	if !hasShortURLAPI {
		t.Log("ShortURL Kubernetes APIs not available - skipping K8s API tests")
		return
	}

	t.Run("Legacy API -> K8s API visibility", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create via legacy API
		legacyPayload := `{
			"path": "d/xCmMwXdVz/dual-write-test"
		}`
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   []byte(legacyPayload),
		}, &dtos.ShortURL{})
		require.NotNil(t, legacyCreate.Result)
		uid := legacyCreate.Result.UID
		require.NotEmpty(t, uid)

		// Should be visible via K8s API
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, uid, found.GetName())

		// Verify cross-API consistency
		getFromBothAPIs(t, helper, client, uid)

		// Clean up
		err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API -> Legacy API visibility", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create via K8s API
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/shorturl.grafana.app/v1alpha1/namespaces/default/shorturls",
			Body:   []byte(`{ "metadata": { "generateName": "test-" }, "spec": { "path": "d/xCmMwXdVz/k8s-dual-write" } }`),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()
		assert.NotEmpty(t, uid)

		// Should be visible via legacy API
		legacyShortURL := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/short-urls/" + uid,
		}, &shorturls.ShortUrl{}).Result
		require.NotNil(t, legacyShortURL)
		assert.Equal(t, uid, legacyShortURL.Uid)

		// Verify cross-API consistency
		getFromBothAPIs(t, helper, client, uid)

		// Clean up
		err := client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("Redirect functionality", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create via K8s API
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/shorturl.grafana.app/v1alpha1/namespaces/default/shorturls",
			Body:   []byte(`{ "metadata": { "generateName": "redirect-" }, "spec": { "path": "d/test/redirect" } }`),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()

		// Test redirect functionality and lastSeenAt update
		redirectResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/goto/" + uid + "?orgId=default",
		}, (*interface{})(nil))
		assert.Equal(t, 302, redirectResponse.Response.StatusCode)

		// Verify lastSeenAt was updated (should be > 0 now)
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		status, exists := found.Object["status"].(map[string]interface{})
		assert.True(t, exists)
		lastSeenAt, exists := status["lastSeenAt"].(int64)
		assert.True(t, exists)

		assert.Greater(t, lastSeenAt, int64(0))

		// Clean up
		err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// doUnifiedOnlyTests tests functionality for Modes 4-5 (unified only)
// Only K8s API, no legacy API interaction
func doUnifiedOnlyTests(t *testing.T, helper *apis.K8sTestHelper) {
	// Check if shortURL K8s APIs are available
	hasShortURLAPI := checkShortURLAPIAvailable(t, helper)
	if !hasShortURLAPI {
		t.Log("ShortURL Kubernetes APIs not available - skipping K8s API tests")
		return
	}

	t.Run("K8s API CRUD (unified storage only)", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create via K8s API
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/shorturl.grafana.app/v1alpha1/namespaces/default/shorturls",
			Body:   []byte(`{ "metadata": { "generateName": "unified-" }, "spec": { "path": "d/xCmMwXdVz/unified-only" } }`),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()
		assert.NotEmpty(t, uid)

		// Read via K8s API
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, uid, found.GetName())

		// Should NOT be visible via legacy API in unified-only mode
		legacyResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/short-urls/" + uid,
		}, (*shorturls.ShortUrl)(nil))
		// In unified-only mode, legacy API should not see the resource
		assert.Nil(t, legacyResponse.Result)

		// Clean up
		err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("K8s API validation - invalid paths", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		testCases := []struct {
			name          string
			path          string
			expectedError string
		}{
			{
				name:          "absolute path should be rejected",
				path:          "/dashboard/absolute-path",
				expectedError: "path should be relative",
			},
			{
				name:          "path with directory traversal should be rejected",
				path:          "d/../../../etc/passwd",
				expectedError: "invalid short URL path",
			},
			{
				name:          "path with multiple directory traversals should be rejected",
				path:          "d/some/../path/../../../secret",
				expectedError: "invalid short URL path",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				// Attempt to create ShortURL with invalid path
				invalidBody := fmt.Sprintf(`{ "metadata": { "generateName": "invalid-" }, "spec": { "path": "%s" } }`, tc.path)
				response := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodPost,
					Path:   "/apis/shorturl.grafana.app/v1alpha1/namespaces/default/shorturls",
					Body:   []byte(invalidBody),
				}, (*unstructured.Unstructured)(nil))

				// Should get a validation error, it should be 400 Bad Request but the validation hook returns 403 Forbidden
				assert.Equal(t, http.StatusForbidden, response.Response.StatusCode,
					"Expected 403 for invalid path: %s", tc.path)

				// Check that the error message contains expected validation error
				assert.Contains(t, string(response.Body), tc.expectedError,
					"Response should contain validation error message")

				// Should not have created a resource
				assert.Nil(t, response.Result, "No resource should be created for invalid path")
			})
		}
	})

	t.Run("K8s API validation - valid edge cases", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		validPaths := []string{
			"d/dashboard/valid-path",
			"dashboard/some-id",
			"explore?from=123&to=456",
			"d/abc123/dashboard-with-params?var-test=value",
		}

		for _, validPath := range validPaths {
			t.Run(fmt.Sprintf("valid path: %s", validPath), func(t *testing.T) {
				validBody := fmt.Sprintf(`{ "metadata": { "generateName": "valid-" }, "spec": { "path": "%s" } }`, validPath)
				response := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodPost,
					Path:   "/apis/shorturl.grafana.app/v1alpha1/namespaces/default/shorturls",
					Body:   []byte(validBody),
				}, &unstructured.Unstructured{})

				// Should succeed
				assert.Equal(t, http.StatusCreated, response.Response.StatusCode,
					"Expected 201 Created for valid path: %s", validPath)
				assert.NotNil(t, response.Result, "Resource should be created for valid path")

				if response.Result != nil {
					uid := response.Result.GetName()

					// Clean up
					err := client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
					assert.NoError(t, err, "Cleanup should succeed")
				}
			})
		}
	})

	t.Run("Redirect functionality (unified only)", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create via K8s API
		obj := apis.DoRequest[unstructured.Unstructured](helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/shorturl.grafana.app/v1alpha1/namespaces/default/shorturls",
			Body:   []byte(`{ "metadata": { "generateName": "redirect-unified-" }, "spec": { "path": "d/test/unified-redirect" } }`),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()

		// Test redirect functionality
		redirectResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/goto/" + uid + "?orgId=default",
		}, (*interface{})(nil))
		assert.Equal(t, 302, redirectResponse.Response.StatusCode)

		// Clean up
		err := client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// Helper function to check if shortURL K8s APIs are available
func checkShortURLAPIAvailable(t *testing.T, helper *apis.K8sTestHelper) bool {
	disco := helper.NewDiscoveryClient()
	groups, err := disco.ServerGroups()
	if err != nil {
		t.Logf("Failed to get server groups: %v", err)
		return false
	}

	for _, group := range groups.Groups {
		if group.Name == "shorturl.grafana.app" {
			return true
		}
	}
	return false
}

// This does a get with both k8s and legacy API, and verifies the results are the same
func getFromBothAPIs(t *testing.T,
	helper *apis.K8sTestHelper,
	client *apis.K8sResourceClient,
	uid string,
) {
	t.Helper()

	k8sResource, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, uid, k8sResource.GetName())

	// Legacy API: Try to get the shortURL (might not be implemented)
	legacyShortURL := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   "/api/short-urls/" + uid,
	}, &shorturls.ShortUrl{}).Result

	if legacyShortURL != nil {
		// If legacy API returns data, verify consistency
		spec, ok := k8sResource.Object["spec"].(map[string]interface{})
		require.True(t, ok)
		status, ok := k8sResource.Object["status"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, legacyShortURL.Uid, k8sResource.GetName())
		assert.Equal(t, legacyShortURL.Path, spec["path"].(string))
		assert.Equal(t, legacyShortURL.LastSeenAt, status["lastSeenAt"].(int64))
	}
}

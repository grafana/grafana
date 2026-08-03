package shorturl

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	shorturlV1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = shorturlV1.ShortURLKind().GroupVersionResource()

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationShortURL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// ShortURL is a fully migrated resource: it is enforced to unified storage
	// (mode 5) via setting.MigratedUnifiedResources. Once the migration has run,
	// the legacy `short_url` table is renamed and the storage mode is resolved to
	// unified from the migration log regardless of the configured dualWriterMode.
	// Legacy-only (mode 0) and dual-write (mode 1) configurations are therefore no
	// longer valid for this resource, so only unified storage is exercised here.
	t.Run("with dual write (unified storage, mode 5)", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
				},
			},
		})
		doUnifiedOnlyTests(t, helper)
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
			User: helper.Org1.None,
			GVR:  gvr,
		})

		// Create via K8s API
		obj := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls",
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
			User: helper.Org1.None,
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
					Path:   "/apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls",
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
			User: helper.Org1.None,
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
					Path:   "/apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls",
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
			User: helper.Org1.None,
			GVR:  gvr,
		})

		// Create via K8s API
		obj := apis.DoRequest[unstructured.Unstructured](helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls",
			Body:   []byte(`{ "metadata": { "generateName": "redirect-unified-" }, "spec": { "path": "d/test/unified-redirect" } }`),
		}, &unstructured.Unstructured{})
		require.NotNil(t, obj.Result)

		uid := obj.Result.GetName()

		// Test redirect functionality
		redirectResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/goto/" + uid + "?orgId=default",
		}, (*any)(nil))
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

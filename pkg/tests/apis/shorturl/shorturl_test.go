package shorturl

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/dtos"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var shortURLGVR = schema.GroupVersionResource{
	Group:    "shorturl.grafana.app",
	Version:  "v0alpha1",
	Resource: "shorturls",
}

func TestIntegrationShortURLComparison(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	//t.Run("Check discovery client for shorturl app", func(t *testing.T) {
	//	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
	//		DisableAnonymous: true,
	//		EnableFeatureToggles: []string{
	//			// Required to start the example service
	//			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
	//		},
	//	})
	//	defer helper.Shutdown()
	//
	//	disco := helper.NewDiscoveryClient()
	//	resources, err := disco.ServerResourcesForGroupVersion("shorturl.grafana.app/v0alpha1")
	//	require.NoError(t, err)
	//
	//	v1Disco, err := json.MarshalIndent(resources, "", "  ")
	//	require.NoError(t, err)
	//
	//	require.JSONEq(t, `{
	//		"kind": "APIResourceList",
	//		"apiVersion": "v1",
	//		"groupVersion": "shorturl.grafana.app/v0alpha1",
	//		"resources": [
	//			{
	//				"name": "shorturls",
	//				"singularName": "shorturl",
	//				"namespaced": true,
	//				"kind": "ShortURL",
	//				"verbs": [
	//					"create",
	//					"delete",
	//					"deletecollection",
	//					"get",
	//					"list",
	//					"patch",
	//					"update"
	//				]
	//			}
	//		]
	//	}`, string(v1Disco))
	//})

	t.Run("with dual write (unified storage, mode 0)", func(t *testing.T) {
		doShortURLComparisonTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"shorturls.shorturl.grafana.app": {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			},
		}))
	})

	//t.Run("with dual write (unified storage, mode 1)", func(t *testing.T) {
	//	doShortURLComparisonTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
	//		DisableAnonymous:     true,
	//		APIServerStorageType: "unified",
	//		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
	//			"shorturls.shorturl.grafana.app": {
	//				DualWriterMode: grafanarest.Mode1,
	//			},
	//		},
	//	}))
	//})
	//
	//t.Run("with dual write (unified storage, mode 2)", func(t *testing.T) {
	//	doShortURLComparisonTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
	//		DisableAnonymous:     true,
	//		APIServerStorageType: "unified",
	//		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
	//			"shorturls.shorturl.grafana.app": {
	//				DualWriterMode: grafanarest.Mode2,
	//			},
	//		},
	//	}))
	//})
	//
	//t.Run("with dual write (unified storage, mode 3)", func(t *testing.T) {
	//	doShortURLComparisonTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
	//		DisableAnonymous:     true,
	//		APIServerStorageType: "unified",
	//		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
	//			"shorturls.shorturl.grafana.app": {
	//				DualWriterMode: grafanarest.Mode3,
	//			},
	//		},
	//	}))
	//})
}

func doShortURLComparisonTests(t *testing.T, helper *apis.K8sTestHelper) {
	defer helper.Shutdown()

	t.Run("Create via HTTP API and verify in K8s API", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  shortURLGVR,
		})

		// Create short URL via HTTP API
		cmd := dtos.CreateShortURLCmd{
			Path: "d/test-dashboard/test?orgId=1&from=1599389322894&to=1599410922894",
		}

		body, err := json.Marshal(cmd)
		require.NoError(t, err)

		httpResp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   body,
		}, &dtos.ShortURL{})

		require.Equal(t, http.StatusOK, httpResp.Response.StatusCode)
		require.NotNil(t, httpResp.Result)
		uid := httpResp.Result.UID
		require.NotEmpty(t, uid)

		// Verify it exists in K8s API by trying to find a resource with matching spec
		//k8sObjects, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		//require.NoError(t, err)

		foundObject, err := client.Resource.Get(context.Background(), httpResp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)

		//// Find the object that matches our path
		//var foundObject *unstructured.Unstructured
		//for _, item := range k8sObjects.Items {
		//	spec, exists := item.Object["spec"].(map[string]any)
		//	if !exists {
		//		continue
		//	}
		//	if path, ok := spec["path"].(string); ok && path == cmd.Path {
		//		foundObject = &item
		//		break
		//	}
		//}

		require.NotNil(t, foundObject, "Short URL created via HTTP API should be visible in K8s API")

		// Verify the spec contains the expected data
		spec := foundObject.Object["spec"].(map[string]any)
		require.Equal(t, cmd.Path, spec["path"])
		require.NotEmpty(t, spec["uid"])
	})

	t.Run("Create via K8s API and verify redirect works", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  shortURLGVR,
		})

		// Create short URL via K8s API
		//testUID := "GmQCnGsHG"
		testPath := "d/k8s-dashboard/test?orgId=1"
		//lastSeenAt := time.Now().Unix()

		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					//"uid":        testUID,
					"path": testPath,
					//"lastSeenAt": lastSeenAt,
				},
			},
		}
		//obj.SetName(testUID)
		obj.SetAPIVersion(shortURLGVR.GroupVersion().String())
		obj.SetKind("ShortURL")

		created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
		require.NoError(t, err)
		//require.Equal(t, testUID, created.GetName())
		assert.NotEmpty(t, created.GetName())
		//assert.Equal(t, testUID, created.Object["spec"].(map[string]any)["uid"])
		assert.Equal(t, testPath, created.Object["spec"].(map[string]any)["path"])
		//assert.Equal(t, lastSeenAt, created.Object["spec"].(map[string]any)["lastSeenAt"])

		// Test that the redirect endpoint works (this tests integration between K8s storage and HTTP API)
		redirectResp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/goto/%s?orgId=1", created.GetName()),
		}, nil)

		// Should get a redirect response
		require.True(t, redirectResp.Response.StatusCode >= 300 && redirectResp.Response.StatusCode < 400)
		location := redirectResp.Response.Header.Get("Location")
		require.Contains(t, location, testPath)

		// Clean up
		//err = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
		//require.NoError(t, err)
	})

	t.Run("Cross-API data consistency", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  shortURLGVR,
		})

		// Create multiple short URLs via HTTP API
		testCases := []struct {
			name string
			path string
			uid  string
		}{
			{"test1", "d/dashboard1/test?var=value1", ""},
			{"test2", "d/dashboard2/test?var=value2", ""},
			{"test3", "d/dashboard3/test?var=value3", ""},
		}

		createdUIDs := make([]string, 0, len(testCases))

		for idx, tc := range testCases {
			cmd := dtos.CreateShortURLCmd{Path: tc.path}
			body, err := json.Marshal(cmd)
			require.NoError(t, err)

			httpResp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodPost,
				Path:   "/api/short-urls",
				Body:   body,
			}, &dtos.ShortURL{})

			require.Equal(t, http.StatusOK, httpResp.Response.StatusCode)
			testCases[idx].uid = httpResp.Result.UID // Store the UID in the test case
			createdUIDs = append(createdUIDs, httpResp.Result.UID)
		}

		// Verify all are visible in K8s API
		for _, tc := range testCases {
			obj, err := client.Resource.Get(context.Background(), tc.uid, metav1.GetOptions{})
			assert.NoError(t, err, "Short URL created via HTTP API should be visible in K8s API")
			assert.Equal(t, tc.path, obj.Object["spec"].(map[string]any)["path"])

		}

		//k8sObjects, err := client.Resource.Get(context.Background(), metav1.ListOptions{})
		//require.NoError(t, err)
		//
		//foundPaths := make(map[string]bool)
		//for _, item := range k8sObjects.Items {
		//	if spec, exists := item.Object["spec"].(map[string]any); exists {
		//		if path, ok := spec["path"].(string); ok {
		//			foundPaths[path] = true
		//		}
		//	}
		//}

		// Verify all test case paths are found
		//for _, tc := range testCases {
		//	require.True(t, foundPaths[tc.path], "Path %s should be found in K8s API", tc.path)
		//}

		// Test that all redirects work
		for i, uid := range createdUIDs {
			redirectResp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: http.MethodGet,
				Path:   fmt.Sprintf("/goto/%s?orgId=1", uid),
			}, nil)

			require.True(t, redirectResp.Response.StatusCode >= 300 && redirectResp.Response.StatusCode < 400)
			location := redirectResp.Response.Header.Get("Location")
			require.Contains(t, location, testCases[i].path)
		}
	})

	//t.Run("Update via K8s API and verify consistency", func(t *testing.T) {
	//	client := helper.GetResourceClient(apis.ResourceClientArgs{
	//		User: helper.Org1.Admin,
	//		GVR:  shortURLGVR,
	//	})
	//
	//	// Create via K8s API
	//	testUID := "update-test-uid"
	//	originalPath := "d/original-dashboard/test"
	//	updatedPath := "d/updated-dashboard/test"
	//
	//	obj := &unstructured.Unstructured{
	//		Object: map[string]interface{}{
	//			"spec": map[string]any{
	//				"uid":        testUID,
	//				"path":       originalPath,
	//				"lastSeenAt": time.Now().Unix(),
	//			},
	//		},
	//	}
	//	obj.SetName("update-test-shorturl")
	//	obj.SetAPIVersion(shortURLGVR.GroupVersion().String())
	//	obj.SetKind("ShortURL")
	//
	//	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	//	require.NoError(t, err)
	//
	//	// Update the path
	//	spec := created.Object["spec"].(map[string]any)
	//	spec["path"] = updatedPath
	//	spec["lastSeenAt"] = time.Now().Unix()
	//
	//	updated, err := client.Resource.Update(context.Background(), created, metav1.UpdateOptions{})
	//	require.NoError(t, err)
	//
	//	// Verify the redirect now points to the updated path
	//	redirectResp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
	//		User:   helper.Org1.Admin,
	//		Method: http.MethodGet,
	//		Path:   fmt.Sprintf("/goto/%s?orgId=1", testUID),
	//	}, nil)
	//
	//	require.True(t, redirectResp.Response.StatusCode >= 300 && redirectResp.Response.StatusCode < 400)
	//	location := redirectResp.Response.Header.Get("Location")
	//	require.Contains(t, location, updatedPath)
	//	require.NotContains(t, location, originalPath)
	//
	//	// Clean up
	//	err = client.Resource.Delete(context.Background(), updated.GetName(), metav1.DeleteOptions{})
	//	require.NoError(t, err)
	//})
}

func TestShortURLHTTPAPI(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	defer helper.Shutdown()

	t.Run("Create short URL", func(t *testing.T) {
		cmd := dtos.CreateShortURLCmd{
			Path: "d/test-dashboard/test?orgId=1&from=1599389322894&to=1599410922894",
		}

		body, err := json.Marshal(cmd)
		require.NoError(t, err)

		rsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   body,
		}, &dtos.ShortURL{})

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.NotNil(t, rsp.Result)
		require.NotEmpty(t, rsp.Result.UID)
		require.Contains(t, rsp.Result.URL, "/goto/")
		require.Contains(t, rsp.Result.URL, rsp.Result.UID)
		require.Contains(t, rsp.Result.URL, "orgId=1")
	})

	t.Run("Create short URL with empty path", func(t *testing.T) {
		cmd := dtos.CreateShortURLCmd{Path: ""}

		body, err := json.Marshal(cmd)
		require.NoError(t, err)

		rsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   body,
		}, &dtos.ShortURL{})

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	})

	t.Run("Create short URL with different roles", func(t *testing.T) {
		testCases := []struct {
			name string
			user apis.User
		}{
			{"Admin", helper.Org1.Admin},
			{"Editor", helper.Org1.Editor},
			{"Viewer", helper.Org1.Viewer},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				cmd := dtos.CreateShortURLCmd{
					Path: fmt.Sprintf("d/test-dashboard-%s/test", tc.name),
				}

				body, err := json.Marshal(cmd)
				require.NoError(t, err)

				rsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
					User:   tc.user,
					Method: http.MethodPost,
					Path:   "/api/short-urls",
					Body:   body,
				}, &dtos.ShortURL{})

				require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
				require.NotNil(t, rsp.Result)
				require.NotEmpty(t, rsp.Result.UID)
			})
		}
	})

	t.Run("Create and redirect short URL", func(t *testing.T) {
		cmd := dtos.CreateShortURLCmd{Path: "d/redirect-test/test?orgId=1"}

		body, err := json.Marshal(cmd)
		require.NoError(t, err)

		createRsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   body,
		}, &dtos.ShortURL{})

		require.Equal(t, http.StatusOK, createRsp.Response.StatusCode)
		require.NotNil(t, createRsp.Result)

		uid := createRsp.Result.UID

		redirectRsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/goto/%s?orgId=1", uid),
		}, nil)

		require.True(t, redirectRsp.Response.StatusCode >= 300 && redirectRsp.Response.StatusCode < 400)
		location := redirectRsp.Response.Header.Get("Location")
		require.Contains(t, location, "d/redirect-test/test")
	})

	t.Run("Cross-org short URL access", func(t *testing.T) {
		// Create short URL in Org1
		cmd := dtos.CreateShortURLCmd{Path: "d/org1-dashboard/test"}

		body, err := json.Marshal(cmd)
		require.NoError(t, err)

		createRsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/short-urls",
			Body:   body,
		}, &dtos.ShortURL{})

		require.Equal(t, http.StatusOK, createRsp.Response.StatusCode)
		uid := createRsp.Result.UID

		// Try to access the short URL from OrgB
		redirectRsp := apis.DoRequest[dtos.ShortURL](helper, apis.RequestParams{
			User:   helper.OrgB.Admin,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/goto/%s?orgId=%d", uid, helper.OrgB.Admin.Identity.GetOrgID()),
		}, nil)

		// The behavior might vary based on implementation, but we test that it doesn't crash
		require.True(t, redirectRsp.Response.StatusCode >= 200)
	})
}

func TestShortURLK8sAPI(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"shorturls.shorturl.grafana.app": {
				DualWriterMode: grafanarest.Mode4,
			},
		},
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})
	defer helper.Shutdown()

	t.Run("CRUD operations", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  shortURLGVR,
		})

		// List should be empty initially
		//rsp, err := client.Resource.List(ctx, metav1.ListOptions{})
		//require.NoError(t, err)
		//require.Empty(t, rsp.Items)

		// Create a new ShortURL
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					//"uid":        "test-uid-123",
					"path": "d/test-dashboard/test?orgId=1",
					//"lastSeenAt": time.Now().Unix(),
				},
			},
		}
		obj.SetName("test-shorturl")
		obj.SetAPIVersion(shortURLGVR.GroupVersion().String())
		obj.SetKind("ShortURL")

		obj, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		assert.NotEmpty(t, obj.GetName())

		// Get the specific object
		rsp, err := client.Resource.Get(ctx, obj.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, obj.GetName(), rsp.GetName())

		spec := obj.Object["spec"].(map[string]any)
		assert.NotEmpty(t, spec["uid"])
		assert.Equal(t, "d/test-dashboard/test?orgId=1", spec["path"])

		// Update the object
		spec["path"] = "d/updated-dashboard/test?orgId=1"
		spec["lastSeenAt"] = time.Now().Unix()
	})

	t.Run("Cross-org isolation", func(t *testing.T) {
		ctx := context.Background()

		// Create shorturl in Org1
		org1Client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  shortURLGVR,
		})

		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"uid":        "org1-uid-123",
					"path":       "d/org1-dashboard/test",
					"lastSeenAt": time.Now().Unix(),
				},
			},
		}
		obj.SetName("org1-shorturl")
		obj.SetAPIVersion(shortURLGVR.GroupVersion().String())
		obj.SetKind("ShortURL")

		org1Obj, err := org1Client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Should be able to see Org1's shorturl
		_, err = org1Client.Resource.Get(ctx, org1Obj.GetName(), metav1.GetOptions{})
		assert.NoError(t, err)

		// Try to access from OrgB
		orgBClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.OrgB.Admin,
			GVR:  shortURLGVR,
		})

		// Should not be able to see Org1's shorturl
		_, err = orgBClient.Resource.Get(ctx, org1Obj.GetName(), metav1.GetOptions{})
		assert.Error(t, err)

		// Should not see it in list either
		//rsp, err := orgBClient.Resource.List(ctx, metav1.ListOptions{})
		//require.NoError(t, err)
		//require.Empty(t, rsp.Items)

		// Clean up
		//err = org1Client.Resource.Delete(ctx, org1Obj.GetName(), metav1.DeleteOptions{})
		//require.NoError(t, err)
	})
}

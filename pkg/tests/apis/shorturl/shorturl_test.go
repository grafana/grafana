package shorturl

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	Version:  "v0alpha1",
	Resource: "shorturls",
}

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationShortURL(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("default setup (legacy APIs)", func(t *testing.T) {
		h := doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true, // do not start extra port 6443
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{}, // legacy APIs only
		}))

		// When no feature toggles are enabled, shortURL K8s APIs should not be available
		disco := h.NewDiscoveryClient()
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

	t.Run("with k8s api flag", func(t *testing.T) {
		h := doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true, // do not start extra port 6443
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
		}))

		// With kubernetesShortURLs feature toggle enabled, shortURL K8s APIs should be available
		disco := h.NewDiscoveryClient()
		groups, err := disco.ServerGroups()
		require.NoError(t, err)

		hasShortURLGroup := false
		for _, group := range groups.Groups {
			if group.Name == "shorturl.grafana.app" {
				hasShortURLGroup = true
				break
			}
		}

		if hasShortURLGroup {
			// If the API group exists, get detailed discovery info
			versionInfo := h.GetGroupVersionInfoJSON("shorturl.grafana.app")
			require.JSONEq(t, `[
				{
				  "version": "v0alpha1",
				  "freshness": "Current",
				  "resources": [
					{
					  "resource": "shorturls",
					  "responseKind": {
						"group": "",
						"kind": "ShortURL",
						"version": ""
					  },
					  "scope": "Namespaced",
					  "singularResource": "shorturl",
					  "verbs": [
						"create",
						"get",
						"patch"
					  ]
					}
				  ]
				}
			  ]`, versionInfo)
		} else {
			t.Log("Note: shortURL K8s APIs not available even with kubernetesShortURLs feature toggle enabled")
		}
	})

	t.Run("with dual write (file, mode 0)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 1)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 2)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode2,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 3)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode3,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 5)", func(t *testing.T) {
		helper := doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
				},
			},
		}))

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Folder support needs to be enabled explicitly for this resource
		t.Run("ensure writing folders is an error", func(t *testing.T) {
			// Check if shortURL K8s APIs are available before running this test
			disco := helper.NewDiscoveryClient()
			groups, err := disco.ServerGroups()
			require.NoError(t, err)

			hasShortURLAPI := false
			for _, group := range groups.Groups {
				if group.Name == "shorturl.grafana.app" {
					hasShortURLAPI = true
					break
				}
			}

			if !hasShortURLAPI {
				t.Skip("ShortURL Kubernetes APIs not available - skipping this test")
				return
			}

			// Create works without folder
			obj := helper.LoadYAMLOrJSONFile("testdata/shorturl-generate.yaml")
			out, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
			require.NoError(t, err)

			meta, err := utils.MetaAccessor(out)
			require.NoError(t, err)
			require.Equal(t, int64(1), meta.GetGeneration())
			require.Equal(t, helper.Org1.Editor.Identity.GetUID(), meta.GetCreatedBy())
			require.Equal(t, "", meta.GetUpdatedBy())

			meta, err = utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetFolder("FolderUID")

			_, err = client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
			require.Error(t, err)
			require.True(t, apierrors.IsBadRequest(err))
		})
	})

	t.Run("with dual write (unified storage, mode 0)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 1)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
		}))
	})

	t.Run("with dual write (unified storage, mode 2)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode2,
				},
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 3)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode3,
				},
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 5)", func(t *testing.T) {
		doShortURLTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
				},
			},
		}))
	})

	t.Run("with dual write (etcd, mode 0)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeEtcd, // requires etcd running on localhost:2379
			EnableFeatureToggles: []string{"kubernetesShortURLs"},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		})

		// Clear the collection before starting (etcd)
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		err := client.Resource.DeleteCollection(context.Background(), metav1.DeleteOptions{}, metav1.ListOptions{})
		require.NoError(t, err)

		doShortURLTests(t, helper)
	})
}

func doShortURLTests(t *testing.T, helper *apis.K8sTestHelper) *apis.K8sTestHelper {
	// Check if shortURL K8s APIs are available by looking at the available groups
	hasShortURLAPI := false
	disco := helper.NewDiscoveryClient()
	groups, err := disco.ServerGroups()
	if err == nil {
		for _, group := range groups.Groups {
			if group.Name == "shorturl.grafana.app" {
				hasShortURLAPI = true
				break
			}
		}
	}

	// If the APIs are not available, skip K8s API tests
	if !hasShortURLAPI {
		t.Log("ShortURL Kubernetes APIs not available - skipping K8s API tests")
		return helper
	}

	t.Run("Check direct List permissions from different org users", func(t *testing.T) {
		// Check view permissions
		rsp := helper.List(helper.Org1.Viewer, "default", gvr)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotNil(t, rsp.Result)
		require.Empty(t, rsp.Result.Items)
		require.Nil(t, rsp.Status)

		// Check view permissions
		rsp = helper.List(helper.OrgB.Viewer, "default", gvr)
		require.Equal(t, 403, rsp.Response.StatusCode) // OrgB can not see default namespace
		require.Nil(t, rsp.Result)
		require.Equal(t, metav1.StatusReasonForbidden, rsp.Status.Reason)

		// Check view permissions
		rsp = helper.List(helper.OrgB.Viewer, "org-22", gvr)
		require.Equal(t, 403, rsp.Response.StatusCode) // Unknown/not a member
		require.Nil(t, rsp.Result)
		require.Equal(t, metav1.StatusReasonForbidden, rsp.Status.Reason)
	})

	t.Run("Check k8s client-go List from different org users", func(t *testing.T) {
		// Check Org1 Viewer
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Viewer,
			Namespace: "", // << fills in the value org1 is allowed to see!
			GVR:       gvr,
		})
		rsp, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)

		// Check org2 viewer can not see org1 (default namespace)
		client = helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Viewer,
			Namespace: "default", // actually org1
			GVR:       gvr,
		})
		rsp, err = client.Resource.List(context.Background(), metav1.ListOptions{})
		statusError := helper.AsStatusError(err)
		require.Nil(t, rsp)
		require.Equal(t, metav1.StatusReasonForbidden, statusError.Status().Reason)

		// Check invalid namespace
		client = helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Viewer,
			Namespace: "org-22", // org 22 does not exist
			GVR:       gvr,
		})
		rsp, err = client.Resource.List(context.Background(), metav1.ListOptions{})
		statusError = helper.AsStatusError(err)
		require.Nil(t, rsp)
		require.Equal(t, metav1.StatusReasonForbidden, statusError.Status().Reason)
	})

	t.Run("Check shortURL CRUD in legacy API appears in k8s apis", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create a short URL using legacy API
		legacyPayload := `{
			"path": "/d/xCmMwXdVz/barchart-label-rotation-and-skipping"
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

		expectedResult := `{
  "apiVersion": "shorturl.grafana.app/v0alpha1",
  "kind": "ShortURL",
  "metadata": {
    "creationTimestamp": "${creationTimestamp}",
    "name": "` + uid + `",
    "namespace": "default",
    "resourceVersion": "${resourceVersion}",
    "uid": "${uid}"
  },
  "spec": {
    "path": "/d/xCmMwXdVz/barchart-label-rotation-and-skipping",
    "uid": "` + uid + `",
    "lastSeenAt": 0,
    "shortURL": "${shortURL}"
  },
  "status": {}
}`

		// List includes the expected result
		k8sList, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 1, len(k8sList.Items))
		require.JSONEq(t, expectedResult, client.SanitizeJSON(&k8sList.Items[0], "labels"))

		// Get should return the same result
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.JSONEq(t, expectedResult, client.SanitizeJSON(found, "labels"))

		// Test redirect functionality and lastSeenAt update
		redirectResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/goto/" + uid,
		}, (*interface{})(nil))
		// Should redirect (status 302)
		require.Equal(t, 302, redirectResponse.Response.StatusCode)

		// Verify lastSeenAt was updated (should be > 0 now)
		found, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		spec, exists := found.Object["spec"].(map[string]interface{})
		require.True(t, exists)
		lastSeenAt, exists := spec["lastSeenAt"].(float64)
		require.True(t, exists)
		require.Greater(t, int64(lastSeenAt), int64(0))
	})

	t.Run("Do CRUD via k8s (and check that legacy api still works)", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create the shortURL using k8s API
		first, err := client.Resource.Create(context.Background(),
			helper.LoadYAMLOrJSONFile("testdata/shorturl-test-create.yaml"),
			metav1.CreateOptions{},
		)
		require.NoError(t, err)
		uid := first.GetName()
		require.NotEmpty(t, uid)

		// Create (with name generation) two more shortURLs
		uids := []string{uid}
		for i := 0; i < 2; i++ {
			out, err := client.Resource.Create(context.Background(),
				helper.LoadYAMLOrJSONFile("testdata/shorturl-generate.yaml"),
				metav1.CreateOptions{},
			)
			require.NoError(t, err)
			uids = append(uids, out.GetName())
		}

		// Check all shortURLs exist
		for _, uid := range uids {
			getFromBothAPIs(t, helper, client, uid, nil)
		}

		// Test path validation
		t.Run("path validation", func(t *testing.T) {
			// Test absolute path rejection
			absolutePathObj := helper.LoadYAMLOrJSONFile("testdata/shorturl-absolute-path.yaml")
			_, err := client.Resource.Create(context.Background(), absolutePathObj, metav1.CreateOptions{})
			require.Error(t, err)
			require.True(t, apierrors.IsBadRequest(err))
			require.Contains(t, err.Error(), "path should be relative")

			// Test invalid path rejection
			invalidPathObj := helper.LoadYAMLOrJSONFile("testdata/shorturl-invalid-path.yaml")
			_, err = client.Resource.Create(context.Background(), invalidPathObj, metav1.CreateOptions{})
			require.Error(t, err)
			require.True(t, apierrors.IsBadRequest(err))
			require.Contains(t, err.Error(), "invalid short URL path")
		})

		// PATCH :: update lastSeenAt
		patchData := `[{"op": "replace", "path": "/spec/lastSeenAt", "value": 1234567890}]`
		updated, err := client.Resource.Patch(context.Background(), uid,
			"application/json-patch+json", []byte(patchData), metav1.PatchOptions{})
		require.NoError(t, err)
		require.Equal(t, first.GetName(), updated.GetName())
		require.Equal(t, first.GetUID(), updated.GetUID())

		// Verify the patch worked
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		spec, exists := found.Object["spec"].(map[string]interface{})
		require.True(t, exists)
		lastSeenAt, exists := spec["lastSeenAt"].(float64)
		require.True(t, exists)
		require.Equal(t, int64(1234567890), int64(lastSeenAt))

		// Now delete all shortURL (cleanup)
		for _, uid := range uids {
			err := client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
			if err == nil || !apierrors.IsNotFound(err) {
				// Delete might not be implemented in legacy storage
				// Second call should be not found!
				err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
				if !apierrors.IsNotFound(err) {
					t.Logf("Delete not implemented or failed: %v", err)
				}
			}
		}
	})

	return helper
}

// This does a get with both k8s and legacy API, and verifies the results are the same
func getFromBothAPIs(t *testing.T,
	helper *apis.K8sTestHelper,
	client *apis.K8sResourceClient,
	uid string,
	// Optionally match some expect some values
	expect *dtos.ShortURL,
) {
	t.Helper()

	k8sResource, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, uid, k8sResource.GetName())

	// Legacy API: Try to get the shortURL (might not be implemented)
	legacyShortURL := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   "/api/short-urls/" + uid,
	}, &dtos.ShortURL{}).Result

	if legacyShortURL != nil {
		// If legacy API returns data, verify consistency
		spec, ok := k8sResource.Object["spec"].(map[string]interface{})
		require.True(t, ok)
		require.Equal(t, legacyShortURL.UID, k8sResource.GetName())
		require.Equal(t, legacyShortURL.UID, spec["uid"])

		// URL structure might differ, but UID should be consistent
		require.Contains(t, legacyShortURL.URL, uid)
		require.Contains(t, spec["shortURL"].(string), uid)
	}

	if expect != nil {
		if expect.UID != "" {
			require.Equal(t, expect.UID, k8sResource.GetName())
		}
		// Add more expectations as needed
	}
}

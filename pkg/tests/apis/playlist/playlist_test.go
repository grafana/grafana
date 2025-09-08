package playlist

import (
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = schema.GroupVersionResource{
	Group:    "playlist.grafana.app",
	Version:  "v0alpha1",
	Resource: "playlists",
}

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationPlaylist(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("default setup", func(t *testing.T) {
		h := doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true, // do not start extra port 6443
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{},
		}))

		// The accepted verbs will change when dual write is enabled
		disco := h.GetGroupVersionInfoJSON("playlist.grafana.app")
		// t.Logf("%s", disco)
		require.JSONEq(t, `[
			{
			  "version": "v0alpha1",
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "playlists",
				  "responseKind": {
					"group": "",
					"kind": "Playlist",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "playlist",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "Playlist",
						"version": ""
					  },
					  "subresource": "status",
					  "verbs": [
						"get",
						"patch",
						"update"
					  ]
					}
				  ],
				  "verbs": [
					"create",
					"delete",
					"deletecollection",
					"get",
					"list",
					"patch",
					"update"
				  ]
				}
			  ]
			}
		  ]`, disco)
	})

	t.Run("with k8s api flag", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction: true, // do not start extra port 6443
			DisableAnonymous:  true,
		}))
	})

	t.Run("with dual write (file, mode 0)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 1)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 2)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode2,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 3)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode3,
				},
			},
		}))
	})

	t.Run("with dual write (file, mode 5)", func(t *testing.T) {
		helper := doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
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
			// Create works without folder
			obj := helper.LoadYAMLOrJSONFile("testdata/playlist-generate.yaml")
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
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 1)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified,
			EnableFeatureToggles: []string{},
		}))
	})

	t.Run("with dual write (unified storage, mode 2)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode2,
				},
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 3)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode3,
				},
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 5)", func(t *testing.T) {
		doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for  unified storage
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeUnified, // use the entity api tables
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

		doPlaylistTests(t, helper)
	})

	t.Run("with dual write (etcd, mode 1)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeEtcd, // requires etcd running on localhost:2379
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
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

		doPlaylistTests(t, helper)
	})

	t.Run("with dual write (etcd, mode 2)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeEtcd, // requires etcd running on localhost:2379
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode2,
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

		doPlaylistTests(t, helper)
	})

	t.Run("with dual write (etcd, mode 3)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeEtcd, // requires etcd running on localhost:2379
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode3,
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

		doPlaylistTests(t, helper)
	})

	t.Run("with dual write (etcd, mode 5)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: options.StorageTypeEtcd, // requires etcd running on localhost:2379
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode5,
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

		doPlaylistTests(t, helper)
	})
}

func doPlaylistTests(t *testing.T, helper *apis.K8sTestHelper) *apis.K8sTestHelper {
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

	t.Run("Check playlist CRUD in legacy API appears in k8s apis", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// This includes the raw dashboard values that are currently sent (but should not be and are ignored)
		legacyPayload := `{
			"name": "Test",
			"interval": "20s",
			"items": [
			  {
				"type": "dashboard_by_uid",
				"value": "xCmMwXdVz",
				"dashboards": [
				  {
					"name": "The dashboard",
					"kind": "dashboard",
					"uid": "xCmMwXdVz",
					"url": "/d/xCmMwXdVz/barchart-label-rotation-and-skipping",
					"tags": ["barchart", "gdev", "graph-ng", "panel-tests"],
					"location": "d1de6240-fd2e-4e13-99b6-f9d0c6b0550d"
				  }
				]
			  },
			  {
				"type": "dashboard_by_tag",
				"value": "graph-ng",
				"dashboards": [ "..." ]
			  }
			],
			"uid": ""
		  }`
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/playlists",
			Body:   []byte(legacyPayload),
		}, &playlist.Playlist{})
		require.Equal(t, 200, legacyCreate.Response.StatusCode)
		require.NotNil(t, legacyCreate.Result)
		uid := legacyCreate.Result.UID
		require.NotEmpty(t, uid)

		expectedResult := `{
  "apiVersion": "playlist.grafana.app/v0alpha1",
  "kind": "Playlist",
  "metadata": {
    "creationTimestamp": "${creationTimestamp}",
    "name": "` + uid + `",
    "namespace": "default",
    "resourceVersion": "${resourceVersion}",
    "uid": "${uid}"
  },
  "spec": {
    "interval": "20s",
    "items": [
      {
        "type": "dashboard_by_uid",
        "value": "xCmMwXdVz"
      },
      {
        "type": "dashboard_by_tag",
        "value": "graph-ng"
      }
    ],
    "title": "Test"
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

		// Now modify the interval
		updatedInterval := `"interval": "10m"`
		legacyPayload = strings.Replace(legacyPayload, `"interval": "20s"`, updatedInterval, 1)
		require.JSONEq(t, expectedResult, client.SanitizeJSON(&k8sList.Items[0], "labels"))
		dtoResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPut,
			Path:   "/api/playlists/" + uid,
			Body:   []byte(legacyPayload),
		}, &playlist.PlaylistDTO{})
		require.Equal(t, 200, dtoResponse.Response.StatusCode)
		require.Equal(t, uid, dtoResponse.Result.Uid)
		require.Equal(t, "10m", dtoResponse.Result.Interval)

		expectedUnstructuredResult := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "playlist.grafana.app/v0alpha1",
				"kind":       "Playlist",
				"metadata": map[string]any{
					"creationTimestamp": "123",
					"name":              uid,
					"namespace":         "default",
					"resourceVersion":   "123",
					"uid":               uid,
				},
				"spec": map[string]any{
					"interval": "10m",
					"items": []interface{}{
						map[string]any{
							"type":  "dashboard_by_uid",
							"value": "xCmMwXdVz",
						},
						map[string]any{
							"type":  "dashboard_by_tag",
							"value": "graph-ng",
						},
					},
					"title": "Test",
				},
				"status": map[string]any{},
			},
		}

		accExpected, err := meta.Accessor(expectedUnstructuredResult)
		require.NoError(t, err)
		expectedSpec, _, err := unstructured.NestedMap(expectedUnstructuredResult.Object, "spec")
		require.NoError(t, err)

		// Make sure the changed interval is now returned from k8s
		found, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		foundSpec, _, err := unstructured.NestedMap(found.Object, "spec")
		require.NoError(t, err)

		require.Equal(t, accExpected.GetName(), found.GetName())
		require.Equal(t, expectedSpec, foundSpec)

		// Delete does not return anything
		deleteResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodDelete,
			Path:   "/api/playlists/" + uid,
			Body:   []byte(legacyPayload),
		}, &playlist.PlaylistDTO{}) // response is empty
		require.Equal(t, 200, deleteResponse.Response.StatusCode)

		found, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		statusError := helper.AsStatusError(err)
		require.Nil(t, found)
		require.Equal(t, metav1.StatusReasonNotFound, statusError.Status().Reason)
	})

	t.Run("Do CRUD via k8s (and check that legacy api still works)", func(t *testing.T) {
		t.Skip()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Editor,
			GVR:  gvr,
		})

		// Create the playlist "test"
		first, err := client.Resource.Create(context.Background(),
			helper.LoadYAMLOrJSONFile("testdata/playlist-test-create.yaml"),
			metav1.CreateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "test", first.GetName())
		uids := []string{first.GetName()}

		// Create (with name generation) two playlists
		for i := 0; i < 2; i++ {
			out, err := client.Resource.Create(context.Background(),
				helper.LoadYAMLOrJSONFile("testdata/playlist-generate.yaml"),
				metav1.CreateOptions{},
			)
			require.NoError(t, err)
			uids = append(uids, out.GetName())
		}
		slices.Sort(uids) // make list compare stable

		// Check that everything is returned from the List command
		list, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, uids, SortSlice(Map(list.Items, func(item unstructured.Unstructured) string {
			return item.GetName()
		})))

		// The legacy endpoint has the same results
		searchResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   "/api/playlists",
		}, &playlist.Playlists{})
		require.NotNil(t, searchResponse.Result)
		require.Equal(t, uids, SortSlice(Map(*searchResponse.Result, func(item *playlist.Playlist) string {
			return item.UID
		})))

		// Check all playlists
		for _, uid := range uids {
			getFromBothAPIs(t, helper, client, uid, nil)
		}

		// PUT :: Update the title (full payload)
		updated, err := client.Resource.Update(context.Background(),
			helper.LoadYAMLOrJSONFile("testdata/playlist-test-replace.yaml"),
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, first.GetName(), updated.GetName())
		require.Equal(t, first.GetUID(), updated.GetUID())
		require.Less(t, first.GetResourceVersion(), updated.GetResourceVersion())
		out := getFromBothAPIs(t, helper, client, "test", &playlist.PlaylistDTO{
			Name:     "Test playlist (replaced from k8s; 22m; 1 items; PUT)",
			Interval: "22m",
		})
		require.Equal(t, updated.GetResourceVersion(), out.GetResourceVersion())

		// PATCH :: apply only some fields
		updated, err = client.Resource.Apply(context.Background(), "test",
			helper.LoadYAMLOrJSONFile("testdata/playlist-test-apply.yaml"),
			metav1.ApplyOptions{
				Force:        true,
				FieldManager: "testing",
			},
		)
		require.NoError(t, err)
		require.Equal(t, first.GetName(), updated.GetName())
		require.Equal(t, first.GetUID(), updated.GetUID())
		require.Less(t, first.GetResourceVersion(), updated.GetResourceVersion())
		getFromBothAPIs(t, helper, client, "test", &playlist.PlaylistDTO{
			Name:     "Test playlist (apply from k8s; ??m; ?? items; PATCH)",
			Interval: "22m", // has not changed from previous update
		})

		// Now delete all playlist (three)
		for _, uid := range uids {
			err := client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
			require.NoError(t, err)

			// Second call is not found!
			err = client.Resource.Delete(context.Background(), uid, metav1.DeleteOptions{})
			statusError := helper.AsStatusError(err)
			require.Equal(t, metav1.StatusReasonNotFound, statusError.Status().Reason)

			// Not found from k8s getter
			_, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
			statusError = helper.AsStatusError(err)
			require.Equal(t, metav1.StatusReasonNotFound, statusError.Status().Reason)
		}

		// Check that they are all gone
		list, err = client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	return helper
}

// typescript style map function
func Map[A any, B any](input []A, m func(A) B) []B {
	output := make([]B, len(input))
	for i, element := range input {
		output[i] = m(element)
	}
	return output
}

func SortSlice[A cmp.Ordered](input []A) []A {
	slices.Sort(input)
	return input
}

// This does a get with both k8s and legacy API, and verifies the results are the same
func getFromBothAPIs(t *testing.T,
	helper *apis.K8sTestHelper,
	client *apis.K8sResourceClient,
	uid string,
	// Optionally match some expect some values
	expect *playlist.PlaylistDTO,
) *unstructured.Unstructured {
	t.Helper()

	found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, uid, found.GetName())

	dto := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   "/api/playlists/" + uid,
	}, &playlist.PlaylistDTO{}).Result
	require.NotNil(t, dto)
	require.Equal(t, uid, dto.Uid)

	spec, ok := found.Object["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, dto.Uid, found.GetName())
	require.Equal(t, dto.Name, spec["title"])
	require.Equal(t, dto.Interval, spec["interval"])

	a, errA := json.Marshal(spec["items"])
	b, errB := json.Marshal(dto.Items)
	require.NoError(t, errA)
	require.NoError(t, errB)
	require.JSONEq(t, string(a), string(b))

	if expect != nil {
		if expect.Name != "" {
			require.Equal(t, expect.Name, dto.Name)
			require.Equal(t, expect.Name, spec["title"])
		}
		if expect.Interval != "" {
			require.Equal(t, expect.Interval, dto.Interval)
			require.Equal(t, expect.Interval, spec["interval"])
		}
		if expect.Uid != "" {
			require.Equal(t, expect.Uid, dto.Uid)
			require.Equal(t, expect.Uid, found.GetName())
		}
	}
	return found
}

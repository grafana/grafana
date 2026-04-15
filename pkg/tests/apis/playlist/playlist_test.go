package playlist

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	playlist "github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
	Version:  "v1",
	Resource: "playlists",
}

var RESOURCEGROUP = gvr.GroupResource().String()

func TestIntegrationPlaylist(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("default setup", func(t *testing.T) {
		h := doPlaylistTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true, // do not start extra port 6443
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{"playlistsRBAC"},
		}))

		// The accepted verbs will change when dual write is enabled
		disco, err := h.GetGroupVersionInfoJSON("playlist.grafana.app")
		require.NoError(t, err)
		// t.Logf("%s", disco)
		require.JSONEq(t, `[
          {
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
                  "update",
                  "watch"
                ]
              }
            ],
            "version": "v1"
          },
		  {
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
                  "update",
                  "watch"
                ]
              }
            ],
            "version": "v0alpha1"
          }
        ]`, disco)
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

	t.Run("Check CRUD operations with None role", func(t *testing.T) {
		clientAdmin := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		created, err := clientAdmin.Resource.Create(context.Background(),
			helper.LoadYAMLOrJSONFile("testdata/playlist-generate.yaml"),
			metav1.CreateOptions{},
		)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = clientAdmin.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
		})

		clientNone := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.None,
			GVR:  gvr,
		})

		// Without any RBAC grant, a None-role user is denied all playlist operations.
		t.Run("None role denied by default", func(t *testing.T) {
			_, err = clientNone.Resource.Get(context.Background(), created.GetName(), metav1.GetOptions{})
			require.Error(t, err)

			_, err = clientNone.Resource.List(context.Background(), metav1.ListOptions{})
			require.Error(t, err)

			_, err = clientNone.Resource.Create(context.Background(),
				helper.LoadYAMLOrJSONFile("testdata/playlist-generate.yaml"),
				metav1.CreateOptions{},
			)
			require.Error(t, err)

			_, err = clientNone.Resource.Update(context.Background(), created, metav1.UpdateOptions{})
			require.Error(t, err)

			err = clientNone.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
			require.Error(t, err)
		})

		// When a None-role user is explicitly granted playlists:read via RBAC, they can
		// read playlists — this is the proper fix for the customer use case described in
		// https://github.com/grafana/grafana/issues/115712.
		//
		// Note: we create a fresh user and use a managed: role name so the permission is
		// visible to GetUserPermissions (which filters by OSSRolesPrefixes = ["managed:", "extsvc:"]).
		// AddUserPermissionToDB uses "test:role" which is silently filtered out.
		t.Run("None role with explicit playlists:read can read but not write", func(t *testing.T) {
			noneWithRead := helper.CreateUser("none-with-read", apis.Org1, org.RoleNone, nil)
			noneUserID, err := noneWithRead.Identity.GetInternalID()
			require.NoError(t, err)

			orgID := noneWithRead.Identity.GetOrgID()
			err = helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
				roleName := accesscontrol.ManagedUserRoleName(noneUserID)
				role := &accesscontrol.Role{
					OrgID:   orgID,
					UID:     fmt.Sprintf("managed_user_%d_permissions", noneUserID),
					Name:    roleName,
					Updated: time.Now(),
					Created: time.Now(),
				}
				if _, err := sess.Insert(role); err != nil {
					return err
				}
				if _, err := sess.Insert(accesscontrol.UserRole{
					OrgID:   orgID,
					RoleID:  role.ID,
					UserID:  noneUserID,
					Created: time.Now(),
				}); err != nil {
					return err
				}
				perm := accesscontrol.Permission{
					RoleID:  role.ID,
					Action:  playlist.ActionPlaylistsRead,
					Scope:   "playlists:*",
					Created: time.Now(),
					Updated: time.Now(),
				}
				perm.Kind, perm.Attribute, perm.Identifier = perm.SplitScope()
				_, err := sess.Insert(&perm)
				return err
			})
			require.NoError(t, err)

			clientNoneWithRead := helper.GetResourceClient(apis.ResourceClientArgs{
				User: noneWithRead,
				GVR:  gvr,
			})

			_, err = clientNoneWithRead.Resource.Get(context.Background(), created.GetName(), metav1.GetOptions{})
			require.NoError(t, err, "None user with playlists:read should be able to get a playlist")

			_, err = clientNoneWithRead.Resource.List(context.Background(), metav1.ListOptions{})
			require.NoError(t, err, "None user with playlists:read should be able to list playlists")

			_, err = clientNoneWithRead.Resource.Create(context.Background(),
				helper.LoadYAMLOrJSONFile("testdata/playlist-generate.yaml"),
				metav1.CreateOptions{},
			)
			require.Error(t, err, "None user with only playlists:read should not be able to create")

			_, err = clientNoneWithRead.Resource.Update(context.Background(), created, metav1.UpdateOptions{})
			require.Error(t, err, "None user with only playlists:read should not be able to update")

			err = clientNoneWithRead.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
			require.Error(t, err, "None user with only playlists:read should not be able to delete")
		})
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
  "apiVersion": "playlist.grafana.app/v1",
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
				"apiVersion": "playlist.grafana.app/v1",
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

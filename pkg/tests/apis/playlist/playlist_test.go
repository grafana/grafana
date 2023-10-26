package playlist

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestPlaylist(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t)
	gvr := schema.GroupVersionResource{
		Group:    "playlist.grafana.app",
		Version:  "v0alpha1",
		Resource: "playlists",
	}

	t.Run("Check direct List permissions from different org users", func(t *testing.T) {
		// Check view permissions
		rsp := helper.List(helper.Org1.Viewer, "default", gvr)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotNil(t, rsp.Result)
		require.Empty(t, rsp.Result.Items)
		require.Nil(t, rsp.Status)

		// Check view permissions
		rsp = helper.List(helper.Org2.Viewer, "default", gvr)
		require.Equal(t, 403, rsp.Response.StatusCode) // Org2 can not see default namespace
		require.Nil(t, rsp.Result)
		require.Equal(t, metav1.StatusReasonForbidden, rsp.Status.Reason)

		// Check view permissions
		rsp = helper.List(helper.Org2.Viewer, "org-22", gvr)
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
			User:      helper.Org2.Viewer,
			Namespace: "default", // actually org1
			GVR:       gvr,
		})
		rsp, err = client.Resource.List(context.Background(), metav1.ListOptions{})
		statusError := helper.AsStatusError(err)
		require.Nil(t, rsp)
		require.Equal(t, metav1.StatusReasonForbidden, statusError.Status().Reason)

		// Check invalid namespace
		client = helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org2.Viewer,
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
			  "title": "Test",
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
			  ]
			}
		  }`

		// List includes the expected result
		k8sList, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 1, len(k8sList.Items))
		require.JSONEq(t, expectedResult, client.SanitizeJSON(&k8sList.Items[0]))

		// Get should return the same result
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.JSONEq(t, expectedResult, client.SanitizeJSON(found))

		// Now modify the interval
		updatedInterval := `"interval": "10m"`
		legacyPayload = strings.Replace(legacyPayload, `"interval": "20s"`, updatedInterval, 1)
		expectedResult = strings.Replace(expectedResult, `"interval": "20s"`, updatedInterval, 1)
		dtoResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPut,
			Path:   "/api/playlists/" + uid,
			Body:   []byte(legacyPayload),
		}, &playlist.PlaylistDTO{})
		require.Equal(t, uid, dtoResponse.Result.Uid)
		require.Equal(t, "10m", dtoResponse.Result.Interval)

		// Make sure the changed interval is now returned from k8s
		found, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.JSONEq(t, expectedResult, client.SanitizeJSON(found))

		// Delete does not return anything
		_ = apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodDelete,
			Path:   "/api/playlists/" + uid,
			Body:   []byte(legacyPayload),
		}, &playlist.PlaylistDTO{}) // response is empty

		found, err = client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		statusError := helper.AsStatusError(err)
		require.Nil(t, found)
		require.Equal(t, metav1.StatusReasonNotFound, statusError.Status().Reason)
	})
}

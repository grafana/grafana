package playlist

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestPlaylistCRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t)
	disco := helper.SetGroupVersionResource(
		schema.GroupVersionResource{
			Group:    "playlist.grafana.app",
			Version:  "v0alpha1",
			Resource: "playlists",
		})
	require.NotNil(t, disco)
	require.Equal(t, "playlist", disco.SingularResource)
	require.Equal(t, "Namespaced", string(disco.Scope))

	t.Run("Check List from different org users", func(t *testing.T) {
		// Check view permissions
		rsp := helper.List(helper.Org1.Viewer, "default")
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotNil(t, rsp.Result)
		require.Empty(t, rsp.Result.Items)
		require.Nil(t, rsp.Status)

		// Check view permissions
		rsp = helper.List(helper.Org2.Viewer, "default")
		require.Equal(t, 403, rsp.Response.StatusCode) // Org2 can not see default namespace
		require.Nil(t, rsp.Result)
		require.Equal(t, metav1.StatusReasonForbidden, rsp.Status.Reason)

		// Check view permissions
		rsp = helper.List(helper.Org2.Viewer, "org-22")
		require.Equal(t, 403, rsp.Response.StatusCode) // Unknown/not a member
		require.Nil(t, rsp.Result)
		require.Equal(t, metav1.StatusReasonForbidden, rsp.Status.Reason)
	})

	t.Run("Do simple CRUD via k8s", func(t *testing.T) {
		v := helper.LoadAnyResource("testdata/playlist-generate.yaml")
		require.Equal(t, "playlist.grafana.app/v0alpha1", v.APIVersion)

		// Create with auto generated name
		rsp := helper.PostResource(helper.Org1.Editor, "playlists", v)
		require.Equal(t, 201, rsp.Response.StatusCode) // created!
		require.NotEmpty(t, rsp.Result.Name)
		require.Equal(t, "Playlist with auto generated UID", v.Spec["title"])
		require.Equal(t, "Playlist with auto generated UID", rsp.Result.Spec["title"])

		// Now Update the title
		update := rsp.Result
		update.Spec["title"] = "Change the title"
		rsp = helper.PutResource(helper.Org1.Editor, "playlists", *update)
		require.Equal(t, 200, rsp.Response.StatusCode) // OK
		require.Equal(t, "Change the title", rsp.Result.Spec["title"])
		require.NotEqual(t, update.ResourceVersion, rsp.Result.ResourceVersion) // should be bigger!

		// Viewer can not update!
		update.Spec["interval"] = "1m"
		rsp = helper.PutResource(helper.Org1.Viewer, "playlists", *update)
		require.Equal(t, 403, rsp.Response.StatusCode)
	})
}

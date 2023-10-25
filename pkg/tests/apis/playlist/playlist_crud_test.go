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
	ctx := apis.NewK8sTestContext(t)

	t.Run("Check API Setup", func(t *testing.T) {
		gvr := schema.GroupVersionResource{
			Group:    "playlist.grafana.app",
			Version:  "v0alpha1",
			Resource: "playlists",
		}
		g, ok := ctx.Groups[gvr.Group]
		require.True(t, ok)
		require.Equal(t, gvr.Version, g.PreferredVersion.Version)

		// Check view permissions
		r, list, status := ctx.List(ctx.Org1.Viewer, gvr, "default")
		require.Equal(t, 200, r.StatusCode)
		require.NotNil(t, list)
		require.Empty(t, list.Items)
		require.Nil(t, status)

		// Check view permissions
		r, list, status = ctx.List(ctx.Org2.Viewer, gvr, "default")
		require.Equal(t, 403, r.StatusCode) // Org2 can not see default namespace
		require.Nil(t, list)
		require.Equal(t, metav1.StatusReasonForbidden, status.Reason)

		// Check view permissions
		r, list, status = ctx.List(ctx.Org2.Viewer, gvr, "org-22")
		require.Equal(t, 403, r.StatusCode) // Unknown/not a member
		require.Nil(t, list)
		require.Equal(t, metav1.StatusReasonForbidden, status.Reason)
	})

	t.Run("Do simple CRUD via k8s", func(t *testing.T) {
		v := ctx.LoadAnyResource("testdata/playlist-generate.yaml")
		require.Equal(t, "playlist.grafana.app/v0alpha1", v.APIVersion)

		// Create with auto generated name
		rsp := ctx.PostResource(ctx.Org1.Editor, "playlists", v)
		require.Equal(t, 201, rsp.Response.StatusCode) // created!
		require.NotEmpty(t, rsp.Resource.Name)
		require.Equal(t, "Playlist with auto generated UID", v.Spec["title"])
		require.Equal(t, "Playlist with auto generated UID", rsp.Resource.Spec["title"])

		// Now Update the title
		update := rsp.Resource
		update.Spec["title"] = "Change the title"
		rsp = ctx.PutResource(ctx.Org1.Editor, "playlists", *update)
		require.Equal(t, 200, rsp.Response.StatusCode) // OK
		require.Equal(t, "Change the title", rsp.Resource.Spec["title"])
		require.NotEqual(t, update.ResourceVersion, rsp.Resource.ResourceVersion) // should be bigger!

		// Viewer can not update!
		update.Spec["interval"] = "1m"
		rsp = ctx.PutResource(ctx.Org1.Viewer, "playlists", *update)
		require.Equal(t, 403, rsp.Response.StatusCode)
	})
}

package playlist

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestPlaylist(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t)
	helper.SetGroupVersionResource(
		schema.GroupVersionResource{
			Group:    "playlist.grafana.app",
			Version:  "v0alpha1",
			Resource: "playlists",
		})

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
}

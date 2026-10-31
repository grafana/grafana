package folder

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationMoveFolderToRootDefaultPermissions covers the permissions a folder keeps when
// the legacy folder API moves it to the root, where there is no parent to inherit access from: it
// carries over the access it had through its old parent tree, so the move neither widens nor
// narrows who can reach it. It runs with the ResourcePermission API enabled: with it disabled the
// legacy folder defaults are set by the folder REST storage on create only, so a legacy move to
// the root is not covered.
func TestIntegrationMoveFolderToRootDefaultPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Permission changes must apply right away for the viewer checks below.
	t.Setenv("GF_AUTHORIZATION_CACHE_TTL", "0s")

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"folders.folder.grafana.app":       {DualWriterMode: rest.Mode5},
			"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
		},
		EnableFeatureToggles: []string{featuremgmt.FlagKubernetesAuthzResourcePermissionApis},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	viewerFolders := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Viewer, GVR: gvr})

	createFolder := func(t *testing.T, uid, parentUID string) {
		t.Helper()
		body, err := json.Marshal(map[string]string{"title": uid, "uid": uid, "parentUid": parentUID})
		require.NoError(t, err)
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/folders",
			Body:   body,
		}, &dtos.Folder{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.Equal(t, parentUID, resp.Result.ParentUID)
	}

	setRolePermissions := func(t *testing.T, uid string, roles map[org.RoleType]dashboardaccess.PermissionType) {
		t.Helper()
		items := make([]map[string]any, 0, len(roles))
		for role, level := range roles {
			items = append(items, map[string]any{"role": role, "permission": level})
		}
		body, err := json.Marshal(map[string]any{"items": items})
		require.NoError(t, err)
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:        helper.Org1.Admin,
			Method:      http.MethodPost,
			Path:        "/api/folders/" + uid + "/permissions",
			Body:        body,
			ContentType: "application/json",
		}, &struct{}{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
	}

	// ownRolePermissions returns the folder's own (not inherited) basic-role permissions.
	ownRolePermissions := func(t *testing.T, uid string) map[org.RoleType]dashboardaccess.PermissionType {
		t.Helper()
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/api/folders/" + uid + "/permissions",
		}, &[]dashboards.DashboardACLInfoDTO{})
		require.Equal(t, http.StatusOK, resp.Response.StatusCode, string(resp.Body))
		require.NotNil(t, resp.Result)
		byRole := map[org.RoleType]dashboardaccess.PermissionType{}
		for _, item := range *resp.Result {
			if item.Role == nil || item.Inherited {
				continue
			}
			byRole[*item.Role] = item.Permission
		}
		return byRole
	}

	moveToRoot := func(t *testing.T, uid string) {
		t.Helper()
		move := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/folders/" + uid + "/move",
			Body:   []byte(`{"parentUid":""}`),
		}, &dtos.Folder{})
		require.Equal(t, http.StatusOK, move.Response.StatusCode, string(move.Body))
		require.Equal(t, "", move.Result.ParentUID)
	}

	viewerCanSee := func(uid string) bool {
		_, err := viewerFolders.Resource.Get(ctx, uid, metav1.GetOptions{})
		if err == nil {
			return true
		}
		require.True(t, apierrors.IsForbidden(err), "unexpected error reading folder %s as viewer: %v", uid, err)
		return false
	}

	// A root folder viewers cannot see: created with the defaults, then restricted to admins.
	createFolder(t, "restricted", "")
	setRolePermissions(t, "restricted", map[org.RoleType]dashboardaccess.PermissionType{org.RoleAdmin: dashboardaccess.PERMISSION_ADMIN})
	require.False(t, viewerCanSee("restricted"), "viewer must not see the restricted folder")

	// A root folder with the defaults, plus a grant above the default level for Editors.
	createFolder(t, "open", "")
	setRolePermissions(t, "open", map[org.RoleType]dashboardaccess.PermissionType{
		org.RoleAdmin:  dashboardaccess.PERMISSION_ADMIN,
		org.RoleEditor: dashboardaccess.PERMISSION_ADMIN,
		org.RoleViewer: dashboardaccess.PERMISSION_VIEW,
	})

	t.Run("folder moved out of a restricted folder stays hidden from viewers", func(t *testing.T) {
		createFolder(t, "restricted-child", "restricted")
		require.False(t, viewerCanSee("restricted-child"), "viewer must not see a folder inside the restricted folder")

		// An explicit grant on the folder itself, which the move must leave untouched.
		setRolePermissions(t, "restricted-child", map[org.RoleType]dashboardaccess.PermissionType{org.RoleEditor: dashboardaccess.PERMISSION_ADMIN})

		moveToRoot(t, "restricted-child")

		require.False(t, viewerCanSee("restricted-child"), "a move to the root must not widen access")
		acl := ownRolePermissions(t, "restricted-child")
		require.Equal(t, dashboardaccess.PERMISSION_ADMIN, acl[org.RoleEditor], "the existing Editor grant must be kept")
		require.NotContains(t, acl, org.RoleViewer, "no Viewer grant must be added")
	})

	t.Run("folder moved out of an open folder keeps the access it inherited", func(t *testing.T) {
		createFolder(t, "open-child", "open")
		require.True(t, viewerCanSee("open-child"), "viewer should see a folder inside the open folder")

		moveToRoot(t, "open-child")

		require.True(t, viewerCanSee("open-child"), "viewer should still see the folder after the move to the root")
		legacyGet := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Viewer,
			Method: http.MethodGet,
			Path:   "/api/folders/open-child",
		}, &dtos.Folder{})
		require.Equal(t, http.StatusOK, legacyGet.Response.StatusCode, "viewer should see the moved folder through the legacy API too")

		acl := ownRolePermissions(t, "open-child")
		require.Equal(t, dashboardaccess.PERMISSION_VIEW, acl[org.RoleViewer], "the inherited Viewer grant must be carried over")
		require.Equal(t, dashboardaccess.PERMISSION_ADMIN, acl[org.RoleEditor], "the inherited Editor grant must be carried over at its own level")
	})
}

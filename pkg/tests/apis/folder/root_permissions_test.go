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

// TestIntegrationMoveFolderToRootDefaultPermissions covers the default permissions a folder
// gets when the legacy folder API moves it to the root, where there is no parent to inherit
// access from. It runs with the ResourcePermission API enabled: with it disabled the legacy
// folder defaults are set by the folder REST storage on create only, so a legacy move to the
// root is not covered.
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

	// A root folder viewers cannot see: created with the defaults, then restricted to admins.
	createFolder(t, "parent", "")
	setRolePermissions(t, "parent", map[org.RoleType]dashboardaccess.PermissionType{org.RoleAdmin: dashboardaccess.PERMISSION_ADMIN})
	_, err := viewerFolders.Resource.Get(ctx, "parent", metav1.GetOptions{})
	require.True(t, apierrors.IsForbidden(err), "viewer must not see the restricted parent folder, got: %v", err)

	createFolder(t, "child", "parent")
	_, err = viewerFolders.Resource.Get(ctx, "child", metav1.GetOptions{})
	require.True(t, apierrors.IsForbidden(err), "viewer must not see a folder inside the restricted folder, got: %v", err)

	// An explicit grant above the default level, which the defaults must not lower.
	setRolePermissions(t, "child", map[org.RoleType]dashboardaccess.PermissionType{org.RoleEditor: dashboardaccess.PERMISSION_ADMIN})

	move := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/folders/child/move",
		Body:   []byte(`{"parentUid":""}`),
	}, &dtos.Folder{})
	require.Equal(t, http.StatusOK, move.Response.StatusCode, string(move.Body))
	require.Equal(t, "", move.Result.ParentUID)

	_, err = viewerFolders.Resource.Get(ctx, "child", metav1.GetOptions{})
	require.NoError(t, err, "viewer should see a folder moved to the root")

	legacyGet := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Viewer,
		Method: http.MethodGet,
		Path:   "/api/folders/child",
	}, &dtos.Folder{})
	require.Equal(t, http.StatusOK, legacyGet.Response.StatusCode, "viewer should see a folder moved to the root through the legacy API too")

	acl := ownRolePermissions(t, "child")
	require.Equal(t, dashboardaccess.PERMISSION_ADMIN, acl[org.RoleEditor], "the existing Editor grant must not be lowered to the default")
	require.Equal(t, dashboardaccess.PERMISSION_VIEW, acl[org.RoleViewer], "the missing Viewer default must be added")
}

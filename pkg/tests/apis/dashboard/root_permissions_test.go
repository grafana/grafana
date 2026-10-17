package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersV1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// TestIntegrationRootLevelDefaultPermissions covers the permissions a dashboard or folder gets at
// the root of the folder tree, where there is no parent to inherit access from. Created there, it
// gets the defaults. Moved there, it keeps the access it had through its old folder tree, so the
// move neither widens nor narrows who can reach it. The requests mirror what the frontend sends:
// the grant-permissions annotation is set on every save.
func TestIntegrationRootLevelDefaultPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, tc := range []struct {
		name  string
		flags []string
		// Folder moves are only covered by the ResourcePermission API path: with it disabled
		// the legacy folder permissions are set by the folder REST storage on create only.
		coverFolders bool
	}{
		{name: "legacy permissions"},
		{name: "resource permissions API", flags: []string{featuremgmt.FlagKubernetesAuthzResourcePermissionApis}, coverFolders: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Permission changes must apply right away for the viewer checks below.
			t.Setenv("GF_AUTHORIZATION_CACHE_TTL", "0s")

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
					"folders.folder.grafana.app":       {DualWriterMode: rest.Mode5},
				},
				EnableFeatureToggles: tc.flags,
			})
			t.Cleanup(helper.Shutdown)

			ctx := context.Background()
			folderGVR := foldersV1beta1.FolderResourceInfo.GroupVersionResource()
			dashGVR := dashboardV1.DashboardResourceInfo.GroupVersionResource()
			adminFolders := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: folderGVR})
			adminDashboards := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: dashGVR})
			viewerFolders := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Viewer, GVR: folderGVR})
			viewerDashboards := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Viewer, GVR: dashGVR})
			adminRole, editorRole := string(org.RoleAdmin), string(org.RoleEditor)

			// A root folder viewers cannot see: created with the defaults, then restricted to admins.
			restricted := createRootPermissionsFolder(t, adminFolders, "restricted", "")
			setLegacyPermissions(t, helper, "/api/folders/"+restricted.GetName()+"/permissions",
				[]ResourcePermissionSetting{{Role: &adminRole, Level: ResourcePermissionLevelAdmin}})
			_, err := viewerFolders.Resource.Get(ctx, restricted.GetName(), metav1.GetOptions{})
			require.True(t, apierrors.IsForbidden(err), "viewer must not see the restricted folder, got: %v", err)

			// A root folder with the defaults, plus a grant above the default level for Editors.
			open := createRootPermissionsFolder(t, adminFolders, "open", "")
			setLegacyPermissions(t, helper, "/api/folders/"+open.GetName()+"/permissions", []ResourcePermissionSetting{
				{Role: &adminRole, Level: ResourcePermissionLevelAdmin},
				{Role: &editorRole, Level: ResourcePermissionLevelAdmin},
				{Role: ptr(string(org.RoleViewer)), Level: ResourcePermissionLevelView},
			})

			t.Run("dashboard created at the root is visible to viewers", func(t *testing.T) {
				dash := createRootPermissionsDashboard(t, adminDashboards, "root-dash", "")
				_, err := viewerDashboards.Resource.Get(ctx, dash.GetName(), metav1.GetOptions{})
				require.NoError(t, err, "viewer should see a dashboard created at the root")
			})

			t.Run("dashboard moved out of a restricted folder stays hidden from viewers", func(t *testing.T) {
				dash := createRootPermissionsDashboard(t, adminDashboards, "restricted-dash", restricted.GetName())
				_, err := viewerDashboards.Resource.Get(ctx, dash.GetName(), metav1.GetOptions{})
				require.True(t, apierrors.IsForbidden(err), "viewer must not see a dashboard inside the restricted folder, got: %v", err)

				// An explicit grant on the dashboard itself, which the move must leave untouched.
				setLegacyPermissions(t, helper, "/api/dashboards/uid/"+dash.GetName()+"/permissions",
					[]ResourcePermissionSetting{{Role: &editorRole, Level: ResourcePermissionLevelAdmin}})

				moveToRoot(t, adminDashboards, dash.GetName())

				_, err = viewerDashboards.Resource.Get(ctx, dash.GetName(), metav1.GetOptions{})
				require.True(t, apierrors.IsForbidden(err), "a move to the root must not widen access, got: %v", err)

				acl := getLegacyRolePermissions(t, helper, "/api/dashboards/uid/"+dash.GetName()+"/permissions")
				require.Equal(t, dashboardaccess.PERMISSION_ADMIN, acl[org.RoleEditor], "the existing Editor grant must be kept")
				require.NotContains(t, acl, org.RoleViewer, "no Viewer grant must be added")
			})

			t.Run("dashboard moved out of an open folder keeps the access it inherited", func(t *testing.T) {
				dash := createRootPermissionsDashboard(t, adminDashboards, "open-dash", open.GetName())
				_, err := viewerDashboards.Resource.Get(ctx, dash.GetName(), metav1.GetOptions{})
				require.NoError(t, err, "viewer should see a dashboard inside the open folder")

				moveToRoot(t, adminDashboards, dash.GetName())

				_, err = viewerDashboards.Resource.Get(ctx, dash.GetName(), metav1.GetOptions{})
				require.NoError(t, err, "viewer should still see the dashboard after the move to the root")

				acl := getLegacyRolePermissions(t, helper, "/api/dashboards/uid/"+dash.GetName()+"/permissions")
				require.Equal(t, dashboardaccess.PERMISSION_VIEW, acl[org.RoleViewer], "the inherited Viewer grant must be carried over")
				require.Equal(t, dashboardaccess.PERMISSION_ADMIN, acl[org.RoleEditor], "the inherited Editor grant must be carried over at its own level")
			})

			if !tc.coverFolders {
				return
			}

			t.Run("folder moved out of a restricted folder stays hidden from viewers", func(t *testing.T) {
				child := createRootPermissionsFolder(t, adminFolders, "restricted-child", restricted.GetName())
				_, err := viewerFolders.Resource.Get(ctx, child.GetName(), metav1.GetOptions{})
				require.True(t, apierrors.IsForbidden(err), "viewer must not see a folder inside the restricted folder, got: %v", err)

				moveToRoot(t, adminFolders, child.GetName())

				_, err = viewerFolders.Resource.Get(ctx, child.GetName(), metav1.GetOptions{})
				require.True(t, apierrors.IsForbidden(err), "a move to the root must not widen access, got: %v", err)
			})

			t.Run("folder moved out of an open folder keeps the access it inherited", func(t *testing.T) {
				child := createRootPermissionsFolder(t, adminFolders, "open-child", open.GetName())
				_, err := viewerFolders.Resource.Get(ctx, child.GetName(), metav1.GetOptions{})
				require.NoError(t, err, "viewer should see a folder inside the open folder")

				moveToRoot(t, adminFolders, child.GetName())

				_, err = viewerFolders.Resource.Get(ctx, child.GetName(), metav1.GetOptions{})
				require.NoError(t, err, "viewer should still see the folder after the move to the root")

				acl := getLegacyRolePermissions(t, helper, "/api/folders/"+child.GetName()+"/permissions")
				require.Equal(t, dashboardaccess.PERMISSION_VIEW, acl[org.RoleViewer], "the inherited Viewer grant must be carried over")
				require.Equal(t, dashboardaccess.PERMISSION_ADMIN, acl[org.RoleEditor], "the inherited Editor grant must be carried over at its own level")
			})
		})
	}
}

func ptr[T any](v T) *T { return &v }

func createRootPermissionsFolder(t *testing.T, client *apis.K8sResourceClient, name, parentUID string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": foldersV1beta1.FolderResourceInfo.GroupVersion().String(),
		"kind":       "Folder",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"title": name},
	}}
	stampSaveAnnotations(t, obj, parentUID)
	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return created
}

func createRootPermissionsDashboard(t *testing.T, client *apis.K8sResourceClient, name, folderUID string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": dashboardV1.DashboardResourceInfo.GroupVersion().String(),
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"title": name},
	}}
	stampSaveAnnotations(t, obj, folderUID)
	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return created
}

// stampSaveAnnotations sets the folder and asks for default permissions, like the frontend
// does on every save. The grant annotation is never persisted and is only acted on for a
// resource at the root.
func stampSaveAnnotations(t *testing.T, obj *unstructured.Unstructured, folderUID string) {
	t.Helper()
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetFolder(folderUID)
	meta.SetAnnotation(utils.AnnoKeyGrantPermissions, utils.AnnoGrantPermissionsDefault)
}

func moveToRoot(t *testing.T, client *apis.K8sResourceClient, name string) {
	t.Helper()
	ctx := context.Background()
	obj, err := client.Resource.Get(ctx, name, metav1.GetOptions{})
	require.NoError(t, err)
	stampSaveAnnotations(t, obj, "")
	_, err = client.Resource.Update(ctx, obj, metav1.UpdateOptions{})
	require.NoError(t, err)
}

func setLegacyPermissions(t *testing.T, helper *apis.K8sTestHelper, path string, permissions []ResourcePermissionSetting) {
	t.Helper()
	body, err := json.Marshal(permissionRequest{Items: permissions})
	require.NoError(t, err)
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:        helper.Org1.Admin,
		Method:      http.MethodPost,
		Path:        path,
		Body:        body,
		ContentType: "application/json",
	}, &struct{}{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "failed to set permissions via %s: %s", path, string(resp.Body))
}

// getLegacyRolePermissions returns the resource's own (not inherited) basic-role permissions.
func getLegacyRolePermissions(t *testing.T, helper *apis.K8sTestHelper, path string) map[org.RoleType]dashboardaccess.PermissionType {
	t.Helper()
	resp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, &[]dashboards.DashboardACLInfoDTO{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, fmt.Sprintf("failed to read permissions via %s: %s", path, string(resp.Body)))
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

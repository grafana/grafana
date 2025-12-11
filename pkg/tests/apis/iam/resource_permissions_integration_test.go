package identity

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvrResourcePermissions = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "resourcepermissions",
}

var gvrFolders = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v1beta1",
	Resource: "folders",
}

var gvrDashboards = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v1beta1",
	Resource: "dashboards",
}

type permission struct {
	kind string
	name string
	verb string
}

func newPermission(kind, name, verb string) permission {
	return permission{
		kind: kind,
		name: name,
		verb: verb,
	}
}

func (p permission) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"kind": p.kind,
		"name": p.name,
		"verb": p.verb,
	}
}

func newPermissionMaps(permissions ...permission) []map[string]interface{} {
	permissionsMaps := make([]map[string]interface{}, len(permissions))
	for i, permission := range permissions {
		permissionsMaps[i] = permission.ToMap()
	}
	return permissionsMaps
}

type k8sTestClients struct {
	rpAdmin  *apis.K8sResourceClient
	rpEditor *apis.K8sResourceClient
	rpViewer *apis.K8sResourceClient
}

func newk8sTestHelperClients(helper *apis.K8sTestHelper) *k8sTestClients {
	return &k8sTestClients{
		rpAdmin: helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.OrgID),
			GVR:       gvrResourcePermissions,
		}),
		rpEditor: helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Editor,
			Namespace: helper.Namespacer(helper.Org1.OrgID),
			GVR:       gvrResourcePermissions,
		}),
		rpViewer: helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Viewer,
			Namespace: helper.Namespacer(helper.Org1.OrgID),
			GVR:       gvrResourcePermissions,
		}),
	}
}

func TestIntegrationResourcePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3}
	for _, mode := range modes {
		if mode >= rest.Mode3 {
			t.Skip("Skipping ResourcePermission tests for Mode3+ because default permissions are not written through the new APIs")
			continue
		}
		t.Run(fmt.Sprintf("ResourcePermission CRUD with dual writer mode %d", mode), func(t *testing.T) {
			// Turn off authorization cache so permission changes apply right away in tests
			t.Setenv("GF_AUTHORIZATION_CACHE_TTL", "0s")

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"resourcepermissions.iam.grafana.app": {
						DualWriterMode: mode,
					},
					"folders.folder.grafana.app": {
						DualWriterMode: mode,
					},
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesAuthzResourcePermissionApis,
					// Prevents nested folders from having default permissions
					featuremgmt.FlagKubernetesDashboards,
				},
			})

			// Work around the default permissions applied on root folders
			// so we can test the ResourcePermission APIs without the default permissions interfering
			parentFolder := createRootFolderWithoutDefaultPermissions(t, helper)
			parentUID := parentFolder.GetName()

			clients := newk8sTestHelperClients(helper)
			doResourcePermissionCRUDTests(t, helper, clients, parentUID)
			doResourcePermissionAuthzTests(t, helper, clients, parentUID)
			doResourcePermissionHierarchyTests(t, helper, clients, parentUID)
			doResourcePermissionListFilteringTests(t, helper, clients, parentUID)
			// TODO: Add tests for External JWT authentication
			// doResourcePermissionAccessPolicyTests(t, helper)
		})
	}
}

func doResourcePermissionCRUDTests(t *testing.T, helper *apis.K8sTestHelper, clients *k8sTestClients, parentUID string) {
	t.Run("should create/get/update/delete ResourcePermission using the new APIs", func(t *testing.T) {
		ctx := context.Background()

		// Create ResourcePermission for the folder
		permission := newPermission("ServiceAccount", helper.Org1.ViewerServiceAccount.UID, "view")
		toCreate := createResourcePermissionObject(parentUID, gvrFolders.Group, gvrFolders.Resource, permission)

		created, err := clients.rpAdmin.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdName := created.GetName()
		require.NotEmpty(t, createdName)

		// Verify spec
		spec := created.Object["spec"].(map[string]interface{})
		resource := spec["resource"].(map[string]interface{})
		require.Equal(t, gvrFolders.Group, resource["apiGroup"])
		require.Equal(t, gvrFolders.Resource, resource["resource"])
		require.Equal(t, parentUID, resource["name"])

		// Get the ResourcePermission
		fetched, err := clients.rpAdmin.Resource.Get(ctx, createdName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)
		require.Equal(t, createdName, fetched.GetName())

		// Update the ResourcePermission
		fetched.Object["spec"].(map[string]interface{})["permissions"] = newPermissionMaps(
			newPermission("User", helper.Org1.Viewer.Identity.GetIdentifier(), "edit"),
		)
		updated, err := clients.rpAdmin.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		updatedSpec := updated.Object["spec"].(map[string]interface{})
		permissions := updatedSpec["permissions"].([]interface{})
		require.Len(t, permissions, 1)
		perm := permissions[0].(map[string]interface{})
		require.Equal(t, helper.Org1.Viewer.Identity.GetIdentifier(), perm["name"])
		require.Equal(t, "edit", perm["verb"])

		// Delete should work
		err = clients.rpAdmin.Resource.Delete(ctx, createdName, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = clients.rpAdmin.Resource.Get(ctx, createdName, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)
	})

	t.Run("should return 404 for non-existent ResourcePermission", func(t *testing.T) {
		ctx := context.Background()

		_, err := clients.rpAdmin.Resource.Get(ctx, "folder.grafana.app-folders-unknown", metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)
	})
}

func doResourcePermissionAuthzTests(t *testing.T, helper *apis.K8sTestHelper, clients *k8sTestClients, parentUID string) {
	t.Run("admin can create/update/delete ResourcePermission", func(t *testing.T) {
		ctx := context.Background()

		folder := createTestFolder(t, helper, helper.Org1.Admin, "test-folder-admin", parentUID)
		folderUID := folder.GetName()

		permission := newPermission("User", helper.Org1.Admin.Identity.GetIdentifier(), "admin")

		toCreate := createResourcePermissionObject(folderUID, gvrFolders.Group, gvrFolders.Resource, permission)
		created, err := clients.rpAdmin.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdName := created.GetName()

		// Get the created object
		fetched, err := clients.rpAdmin.Resource.Get(ctx, createdName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		// Update should work
		permission = newPermission("Team", helper.Org1.Staff.UID, "edit")
		fetched.Object["spec"].(map[string]interface{})["permissions"] = []interface{}{permission.ToMap()}

		_, err = clients.rpAdmin.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Delete should work
		err = clients.rpAdmin.Resource.Delete(ctx, createdName, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("editor cannot create ResourcePermission (insufficient permissions)", func(t *testing.T) {
		ctx := context.Background()

		folder := createTestFolder(t, helper, helper.Org1.Admin, "test-folder-editor-deny", parentUID)
		folderUID := folder.GetName()

		permission := newPermission("User", helper.Org1.Editor.Identity.GetIdentifier(), "admin")
		toCreate := createResourcePermissionObject(folderUID, gvrFolders.Group, gvrFolders.Resource, permission)
		_, err := clients.rpEditor.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
	})

	t.Run("viewer cannot create ResourcePermission (insufficient permissions)", func(t *testing.T) {
		ctx := context.Background()

		folder := createTestFolder(t, helper, helper.Org1.Admin, "test-folder-viewer-deny", parentUID)
		folderUID := folder.GetName()

		permission := newPermission("User", helper.Org1.Viewer.Identity.GetIdentifier(), "admin")
		toCreate := createResourcePermissionObject(folderUID, gvrFolders.Group, gvrFolders.Resource, permission)
		_, err := clients.rpViewer.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
	})

	t.Run("viewer can update ResourcePermission of folder they can admin", func(t *testing.T) {
		ctx := context.Background()

		folder := createTestFolder(t, helper, helper.Org1.Admin, "test-folder-viewer-admin", parentUID)
		folderUID := folder.GetName()

		// Grant admin permissions to the viewer
		permission := newPermission("User", helper.Org1.Viewer.Identity.GetIdentifier(), "admin")
		toCreate := createResourcePermissionObject(folderUID, gvrFolders.Group, gvrFolders.Resource, permission)
		_, err := clients.rpAdmin.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		// As a Viewer we should now be able to get and update the ResourcePermission of the folder
		fetched, err := clients.rpViewer.Resource.Get(ctx, "folder.grafana.app-folders-"+folderUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		// Update the ResourcePermission to grant editor permissions
		fetched.Object["spec"].(map[string]interface{})["permissions"] = newPermissionMaps(
			newPermission("BasicRole", "Editor", "edit"),
			newPermission("User", helper.Org1.Viewer.Identity.GetIdentifier(), "admin"),
		)

		_, err = clients.rpViewer.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
		require.NoError(t, err)
	})
}

func doResourcePermissionHierarchyTests(t *testing.T, helper *apis.K8sTestHelper, clients *k8sTestClients, parentUID string) {
	permission := newPermission("BasicRole", "Editor", "admin")

	t.Run("should respect folder hierarchy for folder permissions", func(t *testing.T) {
		ctx := context.Background()

		sub1 := createTestFolder(t, helper, helper.Org1.Admin, "sub1-folder-hierarchy", parentUID)
		sub1UID := sub1.GetName()

		sub2 := createTestFolder(t, helper, helper.Org1.Admin, "sub2-folder-hierarchy", sub1UID)
		sub2UID := sub2.GetName()

		toCreate := createResourcePermissionObject(sub2UID, gvrFolders.Group, gvrFolders.Resource, permission)
		_, err := clients.rpAdmin.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		t.Run("editor can update ResourcePermission of sub2", func(t *testing.T) {
			fetched, err := clients.rpEditor.Resource.Get(ctx, "folder.grafana.app-folders-"+sub2UID, metav1.GetOptions{})
			require.NoError(t, err)

			fetched.Object["spec"].(map[string]interface{})["permissions"] = newPermissionMaps(
				newPermission("BasicRole", "Editor", "admin"),
				newPermission("User", helper.Org1.Viewer.Identity.GetIdentifier(), "edit"),
			)
			_, err = clients.rpEditor.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
			require.NoError(t, err)
		})
		t.Run("editor cannot create ResourcePermission of sub1", func(t *testing.T) {
			toCreate := createResourcePermissionObject(sub1UID, gvrFolders.Group, gvrFolders.Resource, permission)
			_, err := clients.rpEditor.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
			require.Error(t, err)
			var statusErr *errors.StatusError
			require.ErrorAs(t, err, &statusErr)
			require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		})

		// Delete the ResourcePermission of sub2
		err = clients.rpAdmin.Resource.Delete(ctx, "folder.grafana.app-folders-"+sub2UID, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Create a new ResourcePermission for sub2
		toCreate = createResourcePermissionObject(sub1UID, gvrFolders.Group, gvrFolders.Resource, permission)
		_, err = clients.rpAdmin.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		t.Run("editor can create ResourcePermission of sub2 with parent folder permission", func(t *testing.T) {
			toCreate := createResourcePermissionObject(sub2UID, gvrFolders.Group, gvrFolders.Resource, permission)

			_, err = clients.rpEditor.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
			require.NoError(t, err)

			fetched, err := clients.rpEditor.Resource.Get(ctx, "folder.grafana.app-folders-"+sub2UID, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, fetched)

			permissions := fetched.Object["spec"].(map[string]interface{})["permissions"]
			require.Len(t, permissions, 1)
		})
	})

	t.Run("should respect folder hierarchy for dashboard permissions", func(t *testing.T) {
		ctx := context.Background()

		// Create folder and a nested dashboard
		folder := createTestFolder(t, helper, helper.Org1.Admin, "sub1-dashboard-hierarchy", parentUID)
		folderUID := folder.GetName()

		dashboard := createTestDashboard(t, helper, helper.Org1.Admin, "sub2-dashboard", folderUID)
		dashboardUID := dashboard.GetName()

		// Verify dashboard has parent folder annotation
		annotations := dashboard.GetAnnotations()
		require.Equal(t, folderUID, annotations[utils.AnnoKeyFolder])

		t.Run("editor cannot create ResourcePermission of dashboard without parent folder permission", func(t *testing.T) {
			toCreate := createResourcePermissionObject(dashboardUID, gvrDashboards.Group, gvrDashboards.Resource, permission)
			_, err := clients.rpEditor.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
			require.Error(t, err)
			var statusErr *errors.StatusError
			require.ErrorAs(t, err, &statusErr)
			require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		})

		// Admin creates ResourcePermission for parent folder
		toCreate := createResourcePermissionObject(folderUID, gvrFolders.Group, gvrFolders.Resource, permission)
		created, err := clients.rpAdmin.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		t.Run("editor can create ResourcePermission of dashboard with parent folder permission", func(t *testing.T) {
			toCreate := createResourcePermissionObject(dashboardUID, gvrDashboards.Group, gvrDashboards.Resource, permission)
			_, err := clients.rpEditor.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
			require.NoError(t, err)

			fetched, err := clients.rpEditor.Resource.Get(ctx, "dashboard.grafana.app-dashboards-"+dashboardUID, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, fetched)

			permissions := fetched.Object["spec"].(map[string]interface{})["permissions"]
			require.Len(t, permissions, 1)
		})
	})
}

func doResourcePermissionListFilteringTests(t *testing.T, helper *apis.K8sTestHelper, clients *k8sTestClients, parentUID string) {
	viewerCanAdmin := newPermission("BasicRole", "Viewer", "admin")
	viewerCanView := newPermission("BasicRole", "Viewer", "view")
	editorCanAdmin := newPermission("BasicRole", "Editor", "admin")

	ctx := context.Background()

	// Create two folders
	editorFolder := createTestFolder(t, helper, helper.Org1.Admin, "editor-only-folder", parentUID)
	editorFolderUID := editorFolder.GetName()

	viewerFolder := createTestFolder(t, helper, helper.Org1.Admin, "viewer-only-folder", parentUID)
	viewerFolderUID := viewerFolder.GetName()

	dashboardViewerCanAdmin := createTestDashboard(t, helper, helper.Org1.Admin, "dashboard-in-editor-folder-viewer-can-admin", editorFolderUID)
	dashboardViewerCanAdminUID := dashboardViewerCanAdmin.GetName()
	dashboardViewerCanView := createTestDashboard(t, helper, helper.Org1.Admin, "dashboard-in-editor-folder-viewer-can-view", editorFolderUID)
	dashboardViewerCanViewUID := dashboardViewerCanView.GetName()

	// Grant admin permissions to the viewer on folder2 and dashboard1
	rp1 := createResourcePermissionObject(viewerFolderUID, gvrFolders.Group, gvrFolders.Resource, viewerCanAdmin)
	_, err := clients.rpAdmin.Resource.Create(ctx, rp1, metav1.CreateOptions{})
	require.NoError(t, err)
	rp2 := createResourcePermissionObject(dashboardViewerCanAdminUID, gvrDashboards.Group, gvrDashboards.Resource, viewerCanAdmin)
	_, err = clients.rpAdmin.Resource.Create(ctx, rp2, metav1.CreateOptions{})
	require.NoError(t, err)
	// Grant admin permissions to the editor on folder1
	rp3 := createResourcePermissionObject(editorFolderUID, gvrFolders.Group, gvrFolders.Resource, editorCanAdmin)
	_, err = clients.rpAdmin.Resource.Create(ctx, rp3, metav1.CreateOptions{})
	require.NoError(t, err)
	// Grant view permissions to the viewer on dashboard2
	rp4 := createResourcePermissionObject(dashboardViewerCanViewUID, gvrDashboards.Group, gvrDashboards.Resource, viewerCanView)
	_, err = clients.rpAdmin.Resource.Create(ctx, rp4, metav1.CreateOptions{})
	require.NoError(t, err)

	t.Run("Admin can list all ResourcePermissions", func(t *testing.T) {
		// Admin can list all ResourcePermissions
		list, err := clients.rpAdmin.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)

		// Check that all expected items are present (there may be more from other tests)
		itemNames := getNamesFromList(list)
		require.Contains(t, itemNames, rp1.GetName(), "Admin should see viewer folder permission")
		require.Contains(t, itemNames, rp2.GetName(), "Admin should see dashboard viewer can admin permission")
		require.Contains(t, itemNames, rp3.GetName(), "Admin should see editor folder permission")
		require.Contains(t, itemNames, rp4.GetName(), "Admin should see dashboard viewer can view permission")
	})

	t.Run("Viewer can list ResourcePermissions of folder2 and dashboard1", func(t *testing.T) {
		list, err := clients.rpViewer.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)

		itemNames := getNamesFromList(list)
		// Viewer should see permissions for resources they can admin
		require.Contains(t, itemNames, rp1.GetName(), "Viewer should see viewer folder permission")
		require.Contains(t, itemNames, rp2.GetName(), "Viewer should see dashboard viewer can admin permission")

		// Viewer should NOT see permissions for resources they cannot admin
		require.NotContains(t, itemNames, rp3.GetName(), "Viewer should NOT see editor folder permission")
		require.NotContains(t, itemNames, rp4.GetName(), "Viewer should NOT see dashboard viewer can view permission")
	})
	t.Run("Editor can list ResourcePermissions of folder1 and its nested dashboards", func(t *testing.T) {
		list, err := clients.rpEditor.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)

		itemNames := getNamesFromList(list)
		// Editor has admin on editorFolder, so they should see:
		// - rp3 (editorFolder permission)
		// - rp2 (dashboard in editorFolder with admin permission)
		// - rp4 (dashboard in editorFolder with view permission)
		require.Contains(t, itemNames, rp2.GetName(), "Editor should see dashboard admin permission in their folder")
		require.Contains(t, itemNames, rp3.GetName(), "Editor should see their folder permission")
		require.Contains(t, itemNames, rp4.GetName(), "Editor should see dashboard view permission in their folder")

		// Editor should NOT see permissions for viewerFolder
		require.NotContains(t, itemNames, rp1.GetName(), "Editor should NOT see viewer-only folder permission")
	})
}

// Helper functions

func createTestFolder(t *testing.T, helper *apis.K8sTestHelper, user apis.User, title string, parentUID string) *unstructured.Unstructured {
	t.Helper()
	ctx := context.Background()

	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespacer(user.Identity.GetOrgID()),
		GVR:       gvrFolders,
	})
	metadata := map[string]interface{}{
		"generateName": "test-folder-",
		"namespace":    helper.Namespacer(user.Identity.GetOrgID()),
	}

	if parentUID != "" {
		metadata["annotations"] = map[string]interface{}{
			utils.AnnoKeyFolder: parentUID,
		}
	}

	folder := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1beta1",
			"kind":       "Folder",
			"metadata":   metadata,
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}

	created, err := folderClient.Resource.Create(ctx, folder, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	return created
}

// Helper function to delete default permissions
func deleteDefaultPermissions(t *testing.T, client *apis.K8sResourceClient, resourceName string) {
	ctx := context.Background()
	// Delete the resource permission
	err := client.Resource.Delete(ctx, resourceName, metav1.DeleteOptions{})
	require.NoError(t, err)
	// Check if the resource permission is deleted
	_, err = client.Resource.Get(ctx, resourceName, metav1.GetOptions{})
	require.Error(t, err)
	var statusErr *errors.StatusError
	require.ErrorAs(t, err, &statusErr)
	require.Equal(t, int32(404), statusErr.ErrStatus.Code)
}

// Helper function to create a root folder without default permissions
func createRootFolderWithoutDefaultPermissions(t *testing.T, helper *apis.K8sTestHelper) *unstructured.Unstructured {
	t.Helper()

	// Create folder as admin
	folder := createTestFolder(t, helper, helper.Org1.Admin, "root-without-permissions", "")
	folderUID := folder.GetName()

	// Delete default permissions
	rpClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.OrgID),
		GVR:       gvrResourcePermissions,
	})

	// It would be better to create the folder without default permissions, but this is a workaround for the time being
	deleteDefaultPermissions(t, rpClient, "folder.grafana.app-folders-"+folderUID)

	return folder
}

func createTestDashboard(t *testing.T, helper *apis.K8sTestHelper, user apis.User, title, folderUID string) *unstructured.Unstructured {
	t.Helper()
	ctx := context.Background()

	dashboardClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespacer(user.Identity.GetOrgID()),
		GVR:       gvrDashboards,
	})

	dashboard := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1beta1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"generateName": "test-dashboard-",
				"namespace":    helper.Namespacer(user.Identity.GetOrgID()),
				"annotations": map[string]interface{}{
					utils.AnnoKeyFolder: folderUID,
				},
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}

	created, err := dashboardClient.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	return created
}

func createResourcePermissionObject(resourceName, apiGroup, resource string, permissions ...permission) *unstructured.Unstructured {
	permissionMaps := newPermissionMaps(permissions...)
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": iamv0.GROUP + "/" + iamv0.VERSION,
			"kind":       "ResourcePermission",
			"metadata": map[string]interface{}{
				"name": apiGroup + "-" + resource + "-" + resourceName,
			},
			"spec": map[string]interface{}{
				"resource": map[string]interface{}{
					"apiGroup": apiGroup,
					"resource": resource,
					"name":     resourceName,
				},
				"permissions": permissionMaps,
			},
		},
	}
}

func getNamesFromList(list *unstructured.UnstructuredList) []string {
	names := make([]string, len(list.Items))
	for i, item := range list.Items {
		names[i] = item.GetName()
	}
	return names
}

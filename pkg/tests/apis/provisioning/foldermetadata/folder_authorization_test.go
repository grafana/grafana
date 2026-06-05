package foldermetadata

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_CrossFolderWriteDeniedWithoutDestinationAccess verifies that
// writing a file to a folder the caller cannot access is denied, even when the resource
// already exists in a folder the caller can write to.
func TestIntegrationProvisioning_CrossFolderWriteDeniedWithoutDestinationAccess(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "cross-folder-auth-test"

	// Minimal dashboard JSON placed in innerA during repo setup.
	dashboardBody := []byte(`{
		"apiVersion": "dashboard.grafana.app/v0alpha1",
		"kind": "Dashboard",
		"metadata": {"name": "cross-folder-dash"},
		"spec": {"title": "Cross Folder Test Dashboard"}
	}`)

	// Write folder metadata and dashboard before creating the repo so the first
	// sync picks them all up.
	writeToProvisioningPath(t, helper, "innerA/_folder.json", folderMetadataJSON("inner-a-uid", "Inner A"))
	writeToProvisioningPath(t, helper, "innerB/_folder.json", folderMetadataJSON("inner-b-uid", "Inner B"))
	writeToProvisioningPath(t, helper, "innerA/cross-folder-dash.json", dashboardBody)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repoName,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repoName, nil)

	// Verify both folders exist in Grafana before setting permissions.
	_, err := helper.Folders.Resource.Get(ctx, "inner-a-uid", metav1.GetOptions{})
	require.NoError(t, err, "innerA should exist after sync")
	_, err = helper.Folders.Resource.Get(ctx, "inner-b-uid", metav1.GetOptions{})
	require.NoError(t, err, "innerB should exist after sync")

	// Resolve the Viewer user's integer ID so we can set a user-specific folder ACL.
	viewerUserID, err := identity.UserIdentifier(helper.Org1.Viewer.Identity.GetID())
	require.NoError(t, err, "resolve viewer user ID")

	// Grant the Viewer user edit (permission=2) access on innerA only.
	// innerB receives no explicit entry — the Viewer org role has read-only access there.
	// The sessionAccessChecker fallback fires only for users whose org role includes Editor;
	// Viewer org role does not include Editor, so the fallback will not override the denial.
	_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
		"/api/folders/inner-a-uid/permissions",
		map[string]interface{}{
			"items": []map[string]interface{}{
				{"userId": viewerUserID, "permission": 2},
			},
		},
		helper.Org1.Admin,
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code, "setting folder permission on innerA should succeed")

	viewerFiles := helper.NewFilesClient(repoName).WithUser("viewer:viewer")

	// Writing the same dashboard to innerB must be denied.
	// The resource exists in innerA (parsed.Existing != nil); AuthorizeResource now checks
	// both the current DB folder (innerA — passes) and the destination folder (innerB — fails).
	t.Run("cross-folder write denied when destination is inaccessible", func(t *testing.T) {
		resp := viewerFiles.Put(t, "innerB/cross-folder-dash.json", dashboardBody)
		require.Equal(t, http.StatusForbidden, resp.StatusCode,
			"viewer without access to innerB must not be able to write there")
	})

	// Writing the dashboard back into innerA (same folder) must be allowed.
	// Single-folder update: only the destination (innerA) is checked, which passes.
	t.Run("same-folder write allowed when caller has access", func(t *testing.T) {
		resp := viewerFiles.Put(t, "innerA/cross-folder-dash.json", dashboardBody)
		require.Equal(t, http.StatusOK, resp.StatusCode,
			"viewer with edit access on innerA must be able to update a file there")
	})
}

// TestIntegrationProvisioning_FolderAuthorizationWithMetadata verifies folder
// authorization when the provisioningFolderMetadata feature flag is enabled.
// The flag-disabled counterpart lives in the core provisioning package.
func TestIntegrationProvisioning_FolderAuthorizationWithMetadata(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repoName         = "folder-auth-metadata-enabled-repo"
		folderPathPrefix = "parent-with-metadata"
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repoName,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"folders:read", "folders:write", "folders:delete", "folders:create"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})

	adminFiles := helper.NewFilesClient(repoName)
	editorFiles := adminFiles.WithUser("editor:editor")

	// Note: We test folder creation because:
	// 1. It validates that parent folder permissions are checked correctly
	// 2. Folder deletion on the configured branch is intentionally disabled (returns 405)
	// 3. Testing deletion on feature branches requires git repositories with BranchWorkflow
	t.Run("Admin and Editor can create folders", func(t *testing.T) {
		resp := adminFiles.Post(t, folderPathPrefix+"/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "Admin should be able to create parent folder")

		parentUID := adminFiles.ReadFolderUID(t, ctx, folderPathPrefix+"/_folder.json")
		require.NotEmpty(t, parentUID, "parent should have stable UID")

		// Editor should be able to create a child folder.
		// Validates authorization uses stable UID from parent's _folder.json.
		childResp := editorFiles.Post(t, folderPathPrefix+"/child/")
		require.Equal(t, http.StatusOK, childResp.StatusCode, "Editor should be able to create child folder")

		childUID := adminFiles.ReadFolderUID(t, ctx, folderPathPrefix+"/child/_folder.json")
		require.NotEmpty(t, childUID, "child should have stable UID")

		parentUID2 := adminFiles.ReadFolderUID(t, ctx, folderPathPrefix+"/_folder.json")
		require.NotEqual(t, parentUID2, childUID, "parent and child should have different UIDs")

		_, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist with the stable UID")
	})
}

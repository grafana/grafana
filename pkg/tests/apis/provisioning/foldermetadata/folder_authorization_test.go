package foldermetadata

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

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

package foldermetadata

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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

	helper.CreateRepo(t, common.TestRepo{
		Name:                   repoName,
		Target:                 "instance",
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

	// Note: We test folder creation because:
	// 1. It validates that parent folder permissions are checked correctly
	// 2. Folder deletion on the configured branch is intentionally disabled (returns 405)
	// 3. Testing deletion on feature branches requires git repositories with BranchWorkflow
	t.Run("Admin and Editor can create folders", func(t *testing.T) {
		parentPath := folderPathPrefix + "/"
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		parentURL := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, repoName, parentPath)
		req, err := http.NewRequest(http.MethodPost, parentURL, nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "Admin should be able to create parent folder")

		// When metadata is enabled, verify _folder.json was created with stable UID
		parentMeta, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", folderPathPrefix+"/_folder.json")
		require.NoError(t, err, "parent _folder.json should exist when metadata is enabled")
		parentUID, _, _ := unstructured.NestedString(parentMeta.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, parentUID, "parent should have stable UID")

		// Editor should be able to create a child folder.
		// Validates authorization uses stable UID from parent's _folder.json.
		childPath := folderPathPrefix + "/child/"
		childURL := fmt.Sprintf("http://editor:editor@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, repoName, childPath)
		childReq, err := http.NewRequest(http.MethodPost, childURL, nil)
		require.NoError(t, err)
		childResp, err := http.DefaultClient.Do(childReq)
		require.NoError(t, err)
		// nolint:errcheck
		defer childResp.Body.Close()
		require.Equal(t, http.StatusOK, childResp.StatusCode, "Editor should be able to create child folder")

		// Verify child _folder.json was created with its own stable UID
		childMeta, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", folderPathPrefix+"/child/_folder.json")
		require.NoError(t, err, "child _folder.json should exist when metadata is enabled")
		childUID, _, _ := unstructured.NestedString(childMeta.Object, "resource", "file", "metadata", "name")
		require.NotEmpty(t, childUID, "child should have stable UID")

		// Get parent UID to verify they're different
		parentMeta2, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", folderPathPrefix+"/_folder.json")
		require.NoError(t, err)
		parentUID2, _, _ := unstructured.NestedString(parentMeta2.Object, "resource", "file", "metadata", "name")
		require.NotEqual(t, parentUID2, childUID, "parent and child should have different UIDs")
	})
}

package provisioning

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FolderAuthorizationWithoutMetadata verifies folder
// authorization when the provisioningFolderMetadata feature flag is disabled
// (hash-based IDs). The flag-enabled counterpart lives in the foldermetadata/authorization package.
func TestIntegrationProvisioning_FolderAuthorizationWithoutMetadata(t *testing.T) {
	helper := sharedHelper(t)

	const (
		repoName         = "folder-auth-hash-repo"
		folderPathPrefix = "parent-hash"
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

		// Editor should be able to create a child folder.
		// Without metadata: validates authorization uses hash-based parent ID.
		childPath := folderPathPrefix + "/child/"
		childURL := fmt.Sprintf("http://editor:editor@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, repoName, childPath)
		childReq, err := http.NewRequest(http.MethodPost, childURL, nil)
		require.NoError(t, err)
		childResp, err := http.DefaultClient.Do(childReq)
		require.NoError(t, err)
		// nolint:errcheck
		defer childResp.Body.Close()
		require.Equal(t, http.StatusOK, childResp.StatusCode, "Editor should be able to create child folder")
	})
}

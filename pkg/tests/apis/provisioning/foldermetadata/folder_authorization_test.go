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
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_FolderAuthorizationWithMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name                  string
		folderMetadataEnabled bool
		repoName              string
		folderPathPrefix      string
	}{
		{
			name:                  "with folder metadata enabled",
			folderMetadataEnabled: true,
			repoName:              "folder-auth-metadata-enabled-repo",
			folderPathPrefix:      "parent-with-metadata",
		},
		{
			name:                  "without folder metadata (hash-based IDs)",
			folderMetadataEnabled: false,
			repoName:              "folder-auth-hash-repo",
			folderPathPrefix:      "parent-hash",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var helper *common.ProvisioningTestHelper
			if tt.folderMetadataEnabled {
				helper = common.RunGrafana(t, common.WithProvisioningFolderMetadata)
			} else {
				helper = common.RunGrafana(t)
			}
			ctx := context.Background()

			helper.CreateRepo(t, common.TestRepo{
				Name:                   tt.repoName,
				Target:                 "instance",
				SkipResourceAssertions: true,
			})

			// Grant permissions to Editor for folders and dashboards
			helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{"folders:read", "folders:write", "folders:delete", "folders:create"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "*", // Grant to all folders
				},
				{
					Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
					Resource:          "dashboards",
					ResourceAttribute: "uid",
					ResourceID:        "*",
				},
			})

			// Test folder creation with proper authorization
			// Note: We test folder creation because:
			// 1. It validates that parent folder permissions are checked correctly
			// 2. Folder deletion on the configured branch is intentionally disabled (returns 405)
			// 3. Testing deletion on feature branches requires git repositories with BranchWorkflow
			t.Run("Admin and Editor can create folders", func(t *testing.T) {
				// Admin creates a parent folder
				parentPath := tt.folderPathPrefix + "/"
				addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
				parentURL := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, tt.repoName, parentPath)
				req, err := http.NewRequest(http.MethodPost, parentURL, nil)
				require.NoError(t, err)
				resp, err := http.DefaultClient.Do(req)
				require.NoError(t, err)
				// nolint:errcheck
				defer resp.Body.Close()
				require.Equal(t, http.StatusOK, resp.StatusCode, "Admin should be able to create parent folder")

				if tt.folderMetadataEnabled {
					// When metadata is enabled, verify _folder.json was created with stable UID
					parentMeta, err := helper.Repositories.Resource.Get(ctx, tt.repoName, metav1.GetOptions{}, "files", tt.folderPathPrefix+"/_folder.json")
					require.NoError(t, err, "parent _folder.json should exist when metadata is enabled")
					parentUID, _, _ := unstructured.NestedString(parentMeta.Object, "resource", "file", "metadata", "name")
					require.NotEmpty(t, parentUID, "parent should have stable UID")
				}

				// Editor should be able to create a child folder
				// With metadata: validates authorization uses stable UID from parent's _folder.json
				// Without metadata: validates authorization uses hash-based parent ID
				childPath := tt.folderPathPrefix + "/child/"
				childURL := fmt.Sprintf("http://editor:editor@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, tt.repoName, childPath)
				childReq, err := http.NewRequest(http.MethodPost, childURL, nil)
				require.NoError(t, err)
				childResp, err := http.DefaultClient.Do(childReq)
				require.NoError(t, err)
				// nolint:errcheck
				defer childResp.Body.Close()
				require.Equal(t, http.StatusOK, childResp.StatusCode, "Editor should be able to create child folder")

				if tt.folderMetadataEnabled {
					// Verify child _folder.json was created with its own stable UID
					childMeta, err := helper.Repositories.Resource.Get(ctx, tt.repoName, metav1.GetOptions{}, "files", tt.folderPathPrefix+"/child/_folder.json")
					require.NoError(t, err, "child _folder.json should exist when metadata is enabled")
					childUID, _, _ := unstructured.NestedString(childMeta.Object, "resource", "file", "metadata", "name")
					require.NotEmpty(t, childUID, "child should have stable UID")

					// Get parent UID to verify they're different
					parentMeta, err := helper.Repositories.Resource.Get(ctx, tt.repoName, metav1.GetOptions{}, "files", tt.folderPathPrefix+"/_folder.json")
					require.NoError(t, err)
					parentUID, _, _ := unstructured.NestedString(parentMeta.Object, "resource", "file", "metadata", "name")
					require.NotEqual(t, parentUID, childUID, "parent and child should have different UIDs")
				}
			})
		})
	}
}

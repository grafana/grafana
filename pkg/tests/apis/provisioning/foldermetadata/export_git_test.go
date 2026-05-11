package foldermetadata

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// TestIntegrationProvisioning_ExportJob_GitRepo_FolderMetadataEnabled verifies
// that when the provisioningFolderMetadata feature flag is enabled, each
// exported folder contains a _folder.json manifest (no .keep file).
func TestIntegrationProvisioning_ExportJob_GitRepo_FolderMetadataEnabled(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const (
		repoName    = "git-export-with-meta"
		folderUID   = "git-meta-uid"
		folderTitle = "git-meta-folder"
	)
	helper.CreateExportGitRepo(t, repoName)

	createUnmanagedFolder(t, helper.ProvisioningTestHelper, folderUID, folderTitle)

	job := triggerExport(t, helper.ProvisioningTestHelper, repoName)
	require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

	// With the feature flag enabled, a _folder.json manifest must be committed instead of
	// a bare .keep placeholder.  Read the file directly from the git server to avoid the
	// ownership-conflict check that the provisioning files API performs on unmanaged resources.
	data := helper.GitReadFile(t, ctx, repoName, folderTitle+"/_folder.json")

	var manifest foldersV1.Folder
	require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json must be valid JSON")
	require.Equal(t, folderUID, manifest.Name, "_folder.json must carry the folder's stable UID")
	require.Equal(t, folderTitle, manifest.Spec.Title, "_folder.json must carry the folder's title")

	// No .keep file must be present when _folder.json is written.
	require.False(t, helper.GitFileExists(t, ctx, repoName, folderTitle+"/.keep"),
		".keep must not exist when the feature flag is enabled")
}

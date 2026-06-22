package foldermetadata

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MigrateJob_GenerateNewFolderIDs verifies the
// end-to-end migrate flow with the GenerateNewFolderIDs option against a
// folder-target repository and a nested folder hierarchy:
//   - the exported _folder.json at each nested path carries a freshly generated
//     UID (distinct from the originals and from each other),
//   - the subsequent sync creates new managed folders under those UIDs, and
//   - the nested parent/child relationship is preserved via the new UIDs.
//
// A folder-target migration does not run namespace cleanup, so the original
// unmanaged folders are expected to remain untouched alongside the new ones.
func TestIntegrationProvisioning_MigrateJob_GenerateNewFolderIDs(t *testing.T) {
	readFolderManifest := func(t *testing.T, path string) foldersV1.Folder {
		t.Helper()
		data, err := os.ReadFile(path) //nolint:gosec
		require.NoError(t, err, "_folder.json should exist at %s", path)
		var manifest foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json at %s should be valid JSON", path)
		return manifest
	}

	helper := sharedHelper(t)
	ctx := t.Context()

	const (
		repo        = "migrate-newids-repo"
		parentUID   = "migrate-newids-parent-uid"
		parentTitle = "migrate-newids-parent"
		childUID    = "migrate-newids-child-uid"
		childTitle  = "migrate-newids-child"
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	createUnmanagedFolder(t, helper, parentUID, parentTitle)
	createUnmanagedFolderWithParent(t, helper, childUID, childTitle, parentUID)

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message:              "Migrate with new folder IDs",
			GenerateNewFolderIDs: true,
		},
	})

	// The exported _folder.json files (at their nested paths) must carry fresh
	// UIDs, not the originals. Directory nesting derives from titles.
	parentManifest := readFolderManifest(t, filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
	childManifest := readFolderManifest(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle, "_folder.json"))

	newParentUID := parentManifest.Name
	newChildUID := childManifest.Name
	require.NotEmpty(t, newParentUID, "parent _folder.json must carry a UID")
	require.NotEmpty(t, newChildUID, "child _folder.json must carry a UID")
	require.NotEqual(t, parentUID, newParentUID, "migrate should generate a new parent folder UID")
	require.NotEqual(t, childUID, newChildUID, "migrate should generate a new child folder UID")
	require.NotEqual(t, newParentUID, newChildUID, "each folder should get a distinct new UID")
	require.Equal(t, parentTitle, parentManifest.Spec.Title, "parent title should be preserved")
	require.Equal(t, childTitle, childManifest.Spec.Title, "child title should be preserved")

	// After the sync phase the new UIDs exist as managed folders, and the nested
	// parent/child relationship is preserved through the new UIDs.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		newParent, err := helper.Folders.Resource.Get(ctx, newParentUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "new parent folder %q should exist after migrate", newParentUID) {
			return
		}
		assert.Equal(collect, repo, newParent.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"new parent folder should be managed by the repository")

		newChild, err := helper.Folders.Resource.Get(ctx, newChildUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "new child folder %q should exist after migrate", newChildUID) {
			return
		}
		assert.Equal(collect, repo, newChild.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"new child folder should be managed by the repository")
		assert.Equal(collect, newParentUID, newChild.GetAnnotations()[utils.AnnoKeyFolder],
			"new child folder should be nested under the new parent folder")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"migrate should create the nested managed folders under their new UIDs")
}

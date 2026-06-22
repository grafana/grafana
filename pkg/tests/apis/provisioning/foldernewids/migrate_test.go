package foldernewids

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MigrateJob_GenerateNewFolderIDs verifies the
// end-to-end migrate flow with the GenerateNewFolderIDs option: the exported
// _folder.json carries a freshly generated UID, the subsequent sync creates a
// new managed folder under that UID, and the original unmanaged folder (which is
// never referenced by the repository) is removed by the namespace cleanup.
func TestIntegrationProvisioning_MigrateJob_GenerateNewFolderIDs(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const (
		repo        = "migrate-newids-repo"
		folderUID   = "migrate-newids-folder-uid"
		folderTitle = "migrate-newids-folder"
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	createUnmanagedFolder(t, helper, folderUID, folderTitle)

	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message:              "Migrate with new folder IDs",
			GenerateNewFolderIDs: true,
		},
	})

	// The exported _folder.json must carry a fresh UID, not the original.
	data, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, folderTitle, "_folder.json")) //nolint:gosec
	require.NoError(t, err, "_folder.json should be written during migrate")
	var manifest foldersV1.Folder
	require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json should be valid JSON")
	newUID := manifest.Name
	require.NotEmpty(t, newUID, "_folder.json must carry a UID")
	require.NotEqual(t, folderUID, newUID, "migrate should generate a new folder UID")
	require.Equal(t, folderTitle, manifest.Spec.Title, "folder title should be preserved")

	// After the sync phase the new UID exists as a managed folder, and the
	// original unmanaged folder is cleaned up since it is never referenced by
	// the repository.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		newFolder, err := helper.Folders.Resource.Get(ctx, newUID, metav1.GetOptions{})
		if !assert.NoError(collect, err, "new folder %q should exist after migrate", newUID) {
			return
		}
		assert.Equal(collect, repo, newFolder.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"new folder should be managed by the repository")

		_, err = helper.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err),
			"original unmanaged folder %q should be removed by namespace cleanup, got err=%v", folderUID, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"migrate should create the new managed folder and clean up the original")
}

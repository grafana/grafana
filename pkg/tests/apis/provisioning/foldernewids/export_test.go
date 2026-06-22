package foldernewids

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func readFolderManifest(t *testing.T, path string) foldersV1.Folder {
	t.Helper()
	data, err := os.ReadFile(path) //nolint:gosec
	require.NoError(t, err, "_folder.json should exist at %s", path)
	var manifest foldersV1.Folder
	require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json at %s should be valid JSON", path)
	return manifest
}

// TestIntegrationProvisioning_ExportJob_GenerateNewFolderIDs verifies that the
// GenerateNewFolderIDs export option writes a freshly generated UID into each
// folder's _folder.json instead of preserving the original folder identifier,
// while leaving the directory structure (derived from titles) and the folder
// titles untouched. The default behavior (option off) preserves the original UIDs.
func TestIntegrationProvisioning_ExportJob_GenerateNewFolderIDs(t *testing.T) {
	const (
		parentUID   = "newids-parent-uid"
		parentTitle = "newids-parent"
		childUID    = "newids-child-uid"
		childTitle  = "newids-child"
	)

	setup := func(t *testing.T, repo string) *common.ProvisioningTestHelper {
		t.Helper()
		helper := sharedHelper(t)
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "instance",
			Workflows:              []string{"write"},
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		createUnmanagedFolder(t, helper, parentUID, parentTitle)
		createUnmanagedFolderWithParent(t, helper, childUID, childTitle, parentUID)
		return helper
	}

	t.Run("generateNewFolderIDs writes fresh UIDs into folder metadata", func(t *testing.T) {
		const repo = "export-newids-repo"
		helper := setup(t, repo)

		result := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{GenerateNewFolderIDs: true},
		})
		job := &provisioning.Job{}
		require.NoError(t, k8sruntime.DefaultUnstructuredConverter.FromUnstructured(result.Object, job))
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		// Directory structure derives from titles, so it is unaffected by the option.
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle))
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle))

		parentManifest := readFolderManifest(t, filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
		childManifest := readFolderManifest(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle, "_folder.json"))

		// Each manifest carries a freshly generated UID, not the original one.
		require.NotEmpty(t, parentManifest.Name, "parent _folder.json must have a UID")
		require.NotEqual(t, parentUID, parentManifest.Name, "parent _folder.json should carry a new UID")
		require.NotEmpty(t, childManifest.Name, "child _folder.json must have a UID")
		require.NotEqual(t, childUID, childManifest.Name, "child _folder.json should carry a new UID")
		require.NotEqual(t, parentManifest.Name, childManifest.Name, "each folder should get a distinct new UID")

		// Titles are preserved.
		require.Equal(t, parentTitle, parentManifest.Spec.Title)
		require.Equal(t, childTitle, childManifest.Spec.Title)
	})

	t.Run("without generateNewFolderIDs preserves the original UIDs", func(t *testing.T) {
		const repo = "export-keepids-repo"
		helper := setup(t, repo)

		result := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		})
		job := &provisioning.Job{}
		require.NoError(t, k8sruntime.DefaultUnstructuredConverter.FromUnstructured(result.Object, job))
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		parentManifest := readFolderManifest(t, filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
		childManifest := readFolderManifest(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle, "_folder.json"))

		// Default behavior: the original folder UIDs are preserved.
		require.Equal(t, parentUID, parentManifest.Name, "parent _folder.json should preserve the original UID")
		require.Equal(t, childUID, childManifest.Name, "child _folder.json should preserve the original UID")
	})
}

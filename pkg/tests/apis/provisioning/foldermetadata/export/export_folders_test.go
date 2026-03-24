package export

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// createUnmanagedFolder creates a Grafana folder via the folders API without any
// manager annotations, so it will be picked up by the export job.
func createUnmanagedFolder(t *testing.T, helper *common.ProvisioningTestHelper, name, title string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1beta1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	_, err := helper.Folders.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
}

// createUnmanagedFolderWithParent creates an unmanaged Grafana folder nested under parentUID.
func createUnmanagedFolderWithParent(t *testing.T, helper *common.ProvisioningTestHelper, name, title, parentUID string) {
	t.Helper()
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1beta1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
				"annotations": map[string]interface{}{
					"grafana.app/folder": parentUID,
				},
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	_, err := helper.Folders.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
}

// triggerExport submits a push job and waits for it to complete.
func triggerExport(t *testing.T, helper *common.ProvisioningTestHelper, repo string) *provisioning.Job {
	t.Helper()
	result := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push:   &provisioning.ExportJobOptions{},
	})
	jobObj := &provisioning.Job{}
	err := k8sruntime.DefaultUnstructuredConverter.FromUnstructured(result.Object, jobObj)
	require.NoError(t, err, "should be able to decode job status")
	return jobObj
}

// TestIntegrationProvisioning_ExportJob_FolderMetadataFlag verifies that the
// _folder.json files are written during an export (push) job.
func TestIntegrationProvisioning_ExportJob_FolderMetadataFlag(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("flag disabled does not create folder metadata", func(t *testing.T) {
		helper := common.RunGrafana(t)

		const repo = "export-no-meta-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		createUnmanagedFolder(t, helper, "no-meta-folder-uid", "no-meta-folder")

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, "no-meta-folder"), "folder directory must be created by export")

		// The folder directory may be created, but _folder.json must not be present.
		metadataPath := filepath.Join(helper.ProvisioningPath, "no-meta-folder", "_folder.json")
		_, err := os.Stat(metadataPath)
		require.True(t, os.IsNotExist(err), "_folder.json must not be written when the feature flag is disabled")
	})

	t.Run("flag enabled creates metadata for newly exported folder", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)

		const repo = "export-meta-new-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			folderUID   = "export-meta-folder-uid"
			folderTitle = "export-meta-folder"
		)
		createUnmanagedFolder(t, helper, folderUID, folderTitle)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, folderTitle), "folder directory must be created by export")

		// _folder.json must be written inside the folder directory.
		metadataPath := filepath.Join(helper.ProvisioningPath, folderTitle, "_folder.json")
		data, err := os.ReadFile(metadataPath) //nolint:gosec
		require.NoError(t, err, "_folder.json should be created for a newly exported folder when the flag is enabled")

		// The manifest must carry the actual K8s name as the stable UID.
		var manifest foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json should be valid JSON")
		require.Equal(t, folderUID, manifest.Name, "_folder.json should store the folder's K8s name as stable UID")
		require.Equal(t, folderTitle, manifest.Spec.Title, "_folder.json should store the folder title")
	})

	t.Run("flag enabled does not create metadata for already-existing folder directory", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)

		const repo = "export-existing-folder-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		// Simulate a folder directory that already exists in the repository
		const folderTitle = "existing-folder"
		err := os.MkdirAll(filepath.Join(helper.ProvisioningPath, folderTitle), 0o750)
		require.NoError(t, err, "should be able to pre-create folder directory")

		createUnmanagedFolder(t, helper, "existing-folder-uid", folderTitle)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, folderTitle), "folder directory must still exist after export")

		// _folder.json must not be created for a pre-existing folder directory.
		metadataPath := filepath.Join(helper.ProvisioningPath, folderTitle, "_folder.json")
		_, err = os.Stat(metadataPath)
		require.True(t, os.IsNotExist(err), "_folder.json must not be written for a pre-existing folder directory")
	})
}

// TestIntegrationProvisioning_ExportJob_NestedFolders verifies that export correctly
// handles nested folder hierarchies: paths, _folder.json placement, and UID/title content.
func TestIntegrationProvisioning_ExportJob_NestedFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	readFolderManifest := func(t *testing.T, path string) foldersV1.Folder {
		t.Helper()
		data, err := os.ReadFile(path) //nolint:gosec
		require.NoError(t, err, "_folder.json should exist at %s", path)
		var manifest foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json at %s should be valid JSON", path)
		return manifest
	}

	t.Run("flag disabled does not create folder metadata for nested folders", func(t *testing.T) {
		helper := common.RunGrafana(t)

		const repo = "nested-no-meta-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			parentUID   = "nested-no-meta-parent-uid"
			parentTitle = "nested-no-meta-parent"
			childUID    = "nested-no-meta-child-uid"
			childTitle  = "nested-no-meta-child"
		)
		createUnmanagedFolder(t, helper, parentUID, parentTitle)
		createUnmanagedFolderWithParent(t, helper, childUID, childTitle, parentUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle), "parent folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle), "child folder directory must be created by export")

		_, err := os.Stat(filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
		require.True(t, os.IsNotExist(err), "parent _folder.json must not be written when the feature flag is disabled")

		_, err = os.Stat(filepath.Join(helper.ProvisioningPath, parentTitle, childTitle, "_folder.json"))
		require.True(t, os.IsNotExist(err), "child _folder.json must not be written when the feature flag is disabled")
	})

	t.Run("flag enabled skips metadata for all pre-existing folder directories but creates it for new child", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)

		const repo = "nested-middle-existing-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			grandparentUID   = "middle-existing-grandparent-uid"
			grandparentTitle = "middle-existing-grandparent"
			middleUID        = "middle-existing-middle-uid"
			middleTitle      = "middle-existing-middle"
			childUID         = "middle-existing-child-uid"
			childTitle       = "middle-existing-child"
		)

		// MkdirAll creates both grandparentTitle/ and grandparentTitle/middleTitle/ on disk.
		// Both directories are therefore pre-existing from the export's perspective.
		// Only the child directory will be newly created during export.
		err := os.MkdirAll(filepath.Join(helper.ProvisioningPath, grandparentTitle, middleTitle), 0o750)
		require.NoError(t, err, "should be able to pre-create grandparent and middle folder directories")

		createUnmanagedFolder(t, helper, grandparentUID, grandparentTitle)
		createUnmanagedFolderWithParent(t, helper, middleUID, middleTitle, grandparentUID)
		createUnmanagedFolderWithParent(t, helper, childUID, childTitle, middleUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, grandparentTitle), "grandparent folder directory must exist after export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, grandparentTitle, middleTitle), "middle folder directory must exist after export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, grandparentTitle, middleTitle, childTitle), "child folder directory must be created by export")

		// Grandparent directory already existed (created implicitly by MkdirAll) → _folder.json must NOT be written.
		_, err = os.Stat(filepath.Join(helper.ProvisioningPath, grandparentTitle, "_folder.json"))
		require.True(t, os.IsNotExist(err), "grandparent _folder.json must not be written for a pre-existing folder directory")

		// Middle directory already existed → _folder.json must NOT be written.
		_, err = os.Stat(filepath.Join(helper.ProvisioningPath, grandparentTitle, middleTitle, "_folder.json"))
		require.True(t, os.IsNotExist(err), "middle _folder.json must not be written for a pre-existing folder directory")

		// Child directory is new (inside the pre-existing middle dir) → _folder.json must be written.
		childManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, grandparentTitle, middleTitle, childTitle, "_folder.json"))
		require.Equal(t, childUID, childManifest.Name, "child _folder.json should store the child's K8s name")
		require.Equal(t, childTitle, childManifest.Spec.Title, "child _folder.json should store the child title")
	})

	t.Run("flag enabled creates metadata for parent-child folder hierarchy", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)

		const repo = "nested-two-level-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			parentUID   = "two-level-parent-uid"
			parentTitle = "two-level-parent"
			childUID    = "two-level-child-uid"
			childTitle  = "two-level-child"
		)
		createUnmanagedFolder(t, helper, parentUID, parentTitle)
		createUnmanagedFolderWithParent(t, helper, childUID, childTitle, parentUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle), "parent folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle, childTitle), "child folder directory must be created by export")

		parentManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
		require.Equal(t, parentUID, parentManifest.Name, "parent _folder.json should store the parent's K8s name")
		require.Equal(t, parentTitle, parentManifest.Spec.Title, "parent _folder.json should store the parent title")

		childManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, parentTitle, childTitle, "_folder.json"))
		require.Equal(t, childUID, childManifest.Name, "child _folder.json should store the child's K8s name")
		require.Equal(t, childTitle, childManifest.Spec.Title, "child _folder.json should store the child title")
	})

	t.Run("flag enabled creates metadata for three-level folder hierarchy", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)

		const repo = "nested-three-level-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			grandparentUID   = "three-level-grandparent-uid"
			grandparentTitle = "three-level-grandparent"
			parentUID        = "three-level-parent-uid"
			parentTitle      = "three-level-parent"
			childUID         = "three-level-child-uid"
			childTitle       = "three-level-child"
		)
		createUnmanagedFolder(t, helper, grandparentUID, grandparentTitle)
		createUnmanagedFolderWithParent(t, helper, parentUID, parentTitle, grandparentUID)
		createUnmanagedFolderWithParent(t, helper, childUID, childTitle, parentUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, grandparentTitle), "grandparent folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, grandparentTitle, parentTitle), "parent folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, grandparentTitle, parentTitle, childTitle), "child folder directory must be created by export")

		grandparentManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, grandparentTitle, "_folder.json"))
		require.Equal(t, grandparentUID, grandparentManifest.Name)
		require.Equal(t, grandparentTitle, grandparentManifest.Spec.Title)

		parentManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, grandparentTitle, parentTitle, "_folder.json"))
		require.Equal(t, parentUID, parentManifest.Name)
		require.Equal(t, parentTitle, parentManifest.Spec.Title)

		childManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, grandparentTitle, parentTitle, childTitle, "_folder.json"))
		require.Equal(t, childUID, childManifest.Name)
		require.Equal(t, childTitle, childManifest.Spec.Title)
	})

	t.Run("flag enabled creates metadata for sibling folders under a common parent", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)

		const repo = "nested-siblings-repo"
		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "instance",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})

		const (
			parentUID     = "siblings-parent-uid"
			parentTitle   = "siblings-parent"
			siblingAUID   = "sibling-a-uid"
			siblingATitle = "sibling-a"
			siblingBUID   = "sibling-b-uid"
			siblingBTitle = "sibling-b"
		)
		createUnmanagedFolder(t, helper, parentUID, parentTitle)
		createUnmanagedFolderWithParent(t, helper, siblingAUID, siblingATitle, parentUID)
		createUnmanagedFolderWithParent(t, helper, siblingBUID, siblingBTitle, parentUID)

		job := triggerExport(t, helper, repo)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle), "parent folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle, siblingATitle), "sibling A folder directory must be created by export")
		require.DirExists(t, filepath.Join(helper.ProvisioningPath, parentTitle, siblingBTitle), "sibling B folder directory must be created by export")

		parentManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, parentTitle, "_folder.json"))
		require.Equal(t, parentUID, parentManifest.Name)
		require.Equal(t, parentTitle, parentManifest.Spec.Title)

		siblingAManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, parentTitle, siblingATitle, "_folder.json"))
		require.Equal(t, siblingAUID, siblingAManifest.Name)
		require.Equal(t, siblingATitle, siblingAManifest.Spec.Title)

		siblingBManifest := readFolderManifest(t,
			filepath.Join(helper.ProvisioningPath, parentTitle, siblingBTitle, "_folder.json"))
		require.Equal(t, siblingBUID, siblingBManifest.Name)
		require.Equal(t, siblingBTitle, siblingBManifest.Spec.Title)
	})
}

// TestIntegrationProvisioning_ExportJob_GitRepo_FolderFiles verifies the files
// committed to a git repository when exporting Grafana folders, depending on
// the provisioningFolderMetadata feature flag.
//
//   - Flag disabled: each exported folder must contain a .keep placeholder so
//     git can track the otherwise-empty directory.
//   - Flag enabled: each exported folder must contain a _folder.json manifest
//     (no .keep file).
func TestIntegrationProvisioning_ExportJob_GitRepo_FolderFiles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("flag disabled creates .keep files for exported folders", func(t *testing.T) {
		helper := common.RunGrafanaWithGitServerForExport(t)
		ctx := context.Background()

		const repoName = "git-export-no-meta"
		helper.CreateGitRepo(t, repoName)

		createUnmanagedFolder(t, helper.ProvisioningTestHelper, "git-no-meta-uid", "git-no-meta-folder")

		job := triggerExport(t, helper.ProvisioningTestHelper, repoName)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		// Without the feature flag git cannot track an empty directory, so a
		// .keep placeholder must be committed inside every exported folder.
		// The files API rejects hidden-file paths, so we verify via the Gitea raw API.
		require.True(t, helper.GitFileExists(t, ctx, repoName, "git-no-meta-folder/.keep"),
			".keep file must be committed for an exported folder when the feature flag is disabled")

		// No _folder.json must be present when the flag is off.
		_, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "git-no-meta-folder/_folder.json")
		require.True(t, apierrors.IsNotFound(err), "_folder.json must not exist when the feature flag is disabled")
	})

	t.Run("flag enabled creates _folder.json instead of .keep for exported folders", func(t *testing.T) {
		helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()

		const (
			repoName    = "git-export-with-meta"
			folderUID   = "git-meta-uid"
			folderTitle = "git-meta-folder"
		)
		helper.CreateGitRepo(t, repoName)

		createUnmanagedFolder(t, helper.ProvisioningTestHelper, folderUID, folderTitle)

		job := triggerExport(t, helper.ProvisioningTestHelper, repoName)
		require.Equal(t, provisioning.JobStateSuccess, job.Status.State, "export job should succeed")

		// With the feature flag enabled, a _folder.json manifest must be committed instead of
		// a bare .keep placeholder.  Read the file directly from the Gitea server to avoid the
		// ownership-conflict check that the provisioning files API performs on unmanaged resources.
		data := helper.GitReadFile(t, ctx, repoName, folderTitle+"/_folder.json")

		var manifest foldersV1.Folder
		require.NoError(t, json.Unmarshal(data, &manifest), "_folder.json must be valid JSON")
		require.Equal(t, folderUID, manifest.Name, "_folder.json must carry the folder's stable UID")
		require.Equal(t, folderTitle, manifest.Spec.Title, "_folder.json must carry the folder's title")

		// No .keep file must be present when _folder.json is written.
		require.False(t, helper.GitFileExists(t, ctx, repoName, folderTitle+"/.keep"),
			".keep must not exist when the feature flag is enabled")
	})
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

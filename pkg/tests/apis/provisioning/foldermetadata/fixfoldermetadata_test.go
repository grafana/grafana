package foldermetadata

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const folderMetadataFileName = "_folder.json"

// TestIntegrationProvisioning_FixFolderMetadata_MissingFile verifies that the
// fix-folder-metadata job creates _folder.json files for folders that don't
// have them yet.
func TestIntegrationProvisioning_FixFolderMetadata_MissingFile(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "fix-meta-no-metadata"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			// A dashboard inside parent/child/ causes both folders to be
			// created in Grafana during sync.
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		// root folder + parent + parent/child
		ExpectedFolders: 3,
		// parent and parent/child have no _folder.json metadata — that is the
		// exact state the fix-folder-metadata job is exercised against.
		InitialSyncExpectation: common.Warning(),
	})

	// Confirm the metadata files do not exist before the job runs.
	requireFileAbsent(t, filepath.Join(repoPath, "parent", folderMetadataFileName))
	requireFileAbsent(t, filepath.Join(repoPath, "parent", "child", folderMetadataFileName))

	runFixFolderMetadataJob(t, helper, repoName)

	// After the job both folders must have a well-formed metadata file.
	parentUID, _ := requireValidFolderMetadata(t, ctx, helper, repoName, "parent")
	childUID, _ := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child")

	// The two folders should carry distinct UIDs.
	require.NotEqual(t, parentUID, childUID,
		"parent and child folders should have different UIDs")
}

// TestIntegrationProvisioning_FixFolderMetadata_ValidFile verifies that the
// fix-folder-metadata job leaves already-correct _folder.json files unchanged.
func TestIntegrationProvisioning_FixFolderMetadata_ValidFile(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "fix-meta-valid-metadata"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
		// Initial sync warns because parent and parent/child have no _folder.json metadata.
		InitialSyncExpectation: common.Warning(),
	})

	// First run: let the job create the metadata files.
	runFixFolderMetadataJob(t, helper, repoName)

	firstParentUID, firstParentTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent")
	firstChildUID, firstChildTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child")

	// Second run: the metadata files are already correct, nothing should change.
	runFixFolderMetadataJob(t, helper, repoName)

	afterParentUID, afterParentTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent")
	require.Equal(t, firstParentUID, afterParentUID, "parent folder UID must not change when the metadata file is already valid")
	require.Equal(t, firstParentTitle, afterParentTitle, "parent folder title must not change when the metadata file is already valid")
	afterChildUID, afterChildTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child")
	require.Equal(t, firstChildUID, afterChildUID, "child folder UID must not change when the metadata file is already valid")
	require.Equal(t, firstChildTitle, afterChildTitle, "child folder title must not change when the metadata file is already valid")
}

// TestIntegrationProvisioning_FixFolderMetadata_SkipsExistingMetadata verifies
// that the fix-folder-metadata job does not overwrite a _folder.json that is
// already present.
func TestIntegrationProvisioning_FixFolderMetadata_SkipsExistingMetadata(t *testing.T) {
	helper := sharedHelper(t)

	const repoName = "fix-meta-skip-existing"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
		// Initial sync warns because parent and parent/child have no _folder.json metadata.
		InitialSyncExpectation: common.Warning(),
	})

	// Plant _folder.json files with arbitrary UIDs so we can verify the job
	// leaves them untouched.
	const existingParentUID = "existing-uid-parent-9999"
	const existingChildUID = "existing-uid-child-9999"
	writeFolderMetadata(t, filepath.Join(repoPath, "parent"), existingParentUID, "parent")
	writeFolderMetadata(t, filepath.Join(repoPath, "parent", "child"), existingChildUID, "child")

	// The job must leave existing _folder.json files untouched — it only creates
	// metadata for directories that have none at all.
	runFixFolderMetadataJob(t, helper, repoName)

	requireFolderMetadataUID(t, filepath.Join(repoPath, "parent", folderMetadataFileName), existingParentUID)
	requireFolderMetadataUID(t, filepath.Join(repoPath, "parent", "child", folderMetadataFileName), existingChildUID)
}

// TestIntegrationProvisioning_FixFolderMetadata_SkipsMalformedMetadata verifies
// that the fix-folder-metadata job does not overwrite a _folder.json that is
// already present, even when its content is not a valid Folder resource.
func TestIntegrationProvisioning_FixFolderMetadata_SkipsMalformedMetadata(t *testing.T) {
	helper := sharedHelper(t)

	const repoName = "fix-meta-skip-malformed"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
		// Initial sync warns because parent and parent/child have no _folder.json metadata.
		InitialSyncExpectation: common.Warning(),
	})

	// Write _folder.json files that are valid JSON but not Folder resources.
	writeMalformedMetadata(t, filepath.Join(repoPath, "parent"))
	writeMalformedMetadata(t, filepath.Join(repoPath, "parent", "child"))

	// The job must not overwrite existing _folder.json files, even malformed ones.
	runFixFolderMetadataJob(t, helper, repoName)

	// Files should retain their original malformed content.
	requireFileContains(t, filepath.Join(repoPath, "parent", folderMetadataFileName), `"type":"not-a-folder"`)
	requireFileContains(t, filepath.Join(repoPath, "parent", "child", folderMetadataFileName), `"type":"not-a-folder"`)
}

// ── helpers ────────────────────────────────────────────────────────────────

// runFixFolderMetadataJob triggers the fix-folder-metadata job for the given
// repository and waits until it completes successfully.
func runFixFolderMetadataJob(t *testing.T, h *common.ProvisioningTestHelper, repoName string) {
	t.Helper()
	h.TriggerJobAndWaitForSuccess(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
	})
}

// requireFileAbsent asserts that path does not exist on the filesystem.
func requireFileAbsent(t *testing.T, path string) {
	t.Helper()
	_, err := os.Stat(path)
	require.True(t, os.IsNotExist(err), "expected %s to be absent before the job runs", path)
}

// requireValidFolderMetadata reads a _folder.json via the repository files API
// and asserts it is a valid Folder resource (correct apiVersion/kind, non-empty
// UID and title).
func requireValidFolderMetadata(t *testing.T, ctx context.Context, h *common.ProvisioningTestHelper, repoName, folderPath string) (string, string) {
	t.Helper()

	filePath := filepath.Join(folderPath, folderMetadataFileName)
	wrapObj, err := h.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", filePath)
	require.NoError(t, err, "%s: _folder.json should be readable via the files endpoint", filePath)

	apiVersion, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "apiVersion")
	require.Equal(t, "folder.grafana.app/v1", apiVersion, "%s: unexpected apiVersion", filePath)
	kind, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "kind")
	require.Equal(t, "Folder", kind, "%s: unexpected kind", filePath)

	uid, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
	require.NotEmpty(t, uid, "%s: should have a non-empty UID", filePath)
	title, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "spec", "title")
	require.NotEmpty(t, title, "%s: should have a non-empty title", filePath)

	return uid, title
}

// writeFolderMetadata writes a syntactically valid _folder.json that
// references uid as the folder's name.
func writeFolderMetadata(t *testing.T, folderPath, uid, title string) {
	t.Helper()
	f := folders.NewFolder()
	f.SetGroupVersionKind(folders.FolderResourceInfo.GroupVersionKind())
	f.Name = uid
	f.Spec.Title = title

	data, err := json.Marshal(f)
	require.NoError(t, err)

	metadataPath := filepath.Join(folderPath, folderMetadataFileName)
	require.NoError(t, os.WriteFile(metadataPath, data, 0o600)) //nolint:gosec
}

// writeMalformedMetadata writes a _folder.json whose content is valid JSON
// but not a valid Folder resource (wrong schema, absent UID and title).
func writeMalformedMetadata(t *testing.T, folderPath string) {
	t.Helper()
	data := []byte(`{"type":"not-a-folder","description":"wrong format"}`)
	metadataPath := filepath.Join(folderPath, folderMetadataFileName)
	require.NoError(t, os.WriteFile(metadataPath, data, 0o600)) //nolint:gosec
}

// requireFolderMetadataUID reads a _folder.json from the filesystem and asserts
// that its metadata.name equals expectedUID.
func requireFolderMetadataUID(t *testing.T, path, expectedUID string) {
	t.Helper()
	data, err := os.ReadFile(path) //nolint:gosec
	require.NoError(t, err, "reading %s", path)
	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &obj), "parsing %s", path)
	meta, _ := obj["metadata"].(map[string]interface{})
	name, _ := meta["name"].(string)
	require.Equal(t, expectedUID, name, "unexpected UID in %s — job must not overwrite existing _folder.json", path)
}

// requireFileContains reads a file from the filesystem and asserts it contains
// the given substring.
func requireFileContains(t *testing.T, path, substr string) {
	t.Helper()
	data, err := os.ReadFile(path) //nolint:gosec
	require.NoError(t, err, "reading %s", path)
	require.Contains(t, string(data), substr, "unexpected content in %s — job must not overwrite existing _folder.json", path)
}

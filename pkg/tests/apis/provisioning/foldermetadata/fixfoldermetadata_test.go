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

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const folderMetadataFileName = "_folder.json"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func withProvisioningFolderMetadata(opts *testinfra.GrafanaOpts) {
	opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagProvisioningFolderMetadata)
}

// TestIntegrationProvisioning_FixFolderMetadata_MissingFile verifies that the
// fix-folder-metadata job creates _folder.json files for folders that don't
// have them yet.
func TestIntegrationProvisioning_FixFolderMetadata_MissingFile(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, withProvisioningFolderMetadata)
	ctx := context.Background()

	const repoName = "fix-meta-no-metadata"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateRepo(t, common.TestRepo{
		Name:   repoName,
		Path:   repoPath,
		Target: "folder",
		Copies: map[string]string{
			// A dashboard inside parent/child/ causes both folders to be
			// created in Grafana during sync.
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		// root folder + parent + parent/child
		ExpectedFolders: 3,
	})

	// Confirm the metadata files do not exist before the job runs.
	requireFileAbsent(t, filepath.Join(repoPath, "parent", folderMetadataFileName))
	requireFileAbsent(t, filepath.Join(repoPath, "parent", "child", folderMetadataFileName))

	runFixFolderMetadataJob(t, helper, repoName)

	// After the job both folders must have a well-formed metadata file.
	parentUID, _ := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/"+folderMetadataFileName)
	childUID, _ := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child/"+folderMetadataFileName)

	// The two folders should carry distinct UIDs.
	require.NotEqual(t, parentUID, childUID,
		"parent and child folders should have different UIDs")
}

// TestIntegrationProvisioning_FixFolderMetadata_ValidFile verifies that the
// fix-folder-metadata job leaves already-correct _folder.json files unchanged.
func TestIntegrationProvisioning_FixFolderMetadata_ValidFile(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, withProvisioningFolderMetadata)
	ctx := context.Background()

	const repoName = "fix-meta-valid-metadata"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateRepo(t, common.TestRepo{
		Name:   repoName,
		Path:   repoPath,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
	})

	// First run: let the job create the metadata files.
	runFixFolderMetadataJob(t, helper, repoName)

	firstParentUID, firstParentTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/"+folderMetadataFileName)
	firstChildUID, firstChildTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child/"+folderMetadataFileName)

	// Second run: the metadata files are already correct, nothing should change.
	runFixFolderMetadataJob(t, helper, repoName)

	afterParentUID, afterParentTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/"+folderMetadataFileName)
	require.Equal(t, firstParentUID, afterParentUID, "parent folder UID must not change when the metadata file is already valid")
	require.Equal(t, firstParentTitle, afterParentTitle, "parent folder title must not change when the metadata file is already valid")
	afterChildUID, afterChildTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child/"+folderMetadataFileName)
	require.Equal(t, firstChildUID, afterChildUID, "child folder UID must not change when the metadata file is already valid")
	require.Equal(t, firstChildTitle, afterChildTitle, "child folder title must not change when the metadata file is already valid")
}

// TestIntegrationProvisioning_FixFolderMetadata_MismatchedUID verifies that
// the fix-folder-metadata job corrects a _folder.json whose UID does not match
// any real folder in Grafana.
func TestIntegrationProvisioning_FixFolderMetadata_MismatchedUID(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, withProvisioningFolderMetadata)
	ctx := context.Background()

	const repoName = "fix-meta-wrong-uid"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateRepo(t, common.TestRepo{
		Name:   repoName,
		Path:   repoPath,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
	})

	// First run: establish what the correct UIDs and titles are.
	runFixFolderMetadataJob(t, helper, repoName)

	correctParentUID, correctParentTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/"+folderMetadataFileName)
	correctChildUID, correctChildTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child/"+folderMetadataFileName)

	// Overwrite both metadata files with UIDs that do not correspond to
	// any real folder in Grafana.
	writeFolderMetadata(t, filepath.Join(repoPath, "parent"), "mismatched-uid-parent-9999", "parent")
	writeFolderMetadata(t, filepath.Join(repoPath, "parent", "child"), "mismatched-uid-child-9999", "child")

	// The job must detect the mismatch and restore the correct UIDs and titles.
	runFixFolderMetadataJob(t, helper, repoName)

	afterParentUID, afterParentTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/"+folderMetadataFileName)
	require.Equal(t, correctParentUID, afterParentUID, "parent folder UID should be corrected to match the actual Grafana folder")
	require.Equal(t, correctParentTitle, afterParentTitle, "parent folder title should be preserved after UID correction")
	afterChildUID, afterChildTitle := requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child/"+folderMetadataFileName)
	require.Equal(t, correctChildUID, afterChildUID, "child folder UID should be corrected to match the actual Grafana folder")
	require.Equal(t, correctChildTitle, afterChildTitle, "child folder title should be preserved after UID correction")
}

// TestIntegrationProvisioning_FixFolderMetadata_WrongFormat verifies that the
// fix-folder-metadata job rewrites a _folder.json whose content is valid JSON
// but not a valid Folder resource.
func TestIntegrationProvisioning_FixFolderMetadata_WrongFormat(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, withProvisioningFolderMetadata)
	ctx := context.Background()

	const repoName = "fix-meta-wrong-format"
	repoPath := filepath.Join(helper.ProvisioningPath, repoName)

	helper.CreateRepo(t, common.TestRepo{
		Name:   repoName,
		Path:   repoPath,
		Target: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json": "parent/child/dashboard.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
	})

	// Write _folder.json files whose content is valid JSON but does not
	// represent a Folder resource (wrong schema, empty UID, no title).
	writeMalformedMetadata(t, filepath.Join(repoPath, "parent"))
	writeMalformedMetadata(t, filepath.Join(repoPath, "parent", "child"))

	// The job should detect the broken format and rewrite the files.
	runFixFolderMetadataJob(t, helper, repoName)

	// Both files must now be well-formed.
	requireValidFolderMetadata(t, ctx, helper, repoName, "parent/"+folderMetadataFileName)
	requireValidFolderMetadata(t, ctx, helper, repoName, "parent/child/"+folderMetadataFileName)
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

// requireValidFolderMetadata reads a _folder.json via the repository files API,
// asserts it is a valid Folder resource (correct apiVersion/kind, non-empty UID
// and title), and confirms the UID resolves to a real Grafana folder.
// It returns the (uid, title) so callers can assert stability across runs.
func requireValidFolderMetadata(t *testing.T, ctx context.Context, h *common.ProvisioningTestHelper, repoName, filePath string) (string, string) {
	t.Helper()

	wrapObj, err := h.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", filePath)
	require.NoError(t, err, "%s: _folder.json should be readable via the files endpoint", filePath)

	apiVersion, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "apiVersion")
	require.Equal(t, "folder.grafana.app/v1beta1", apiVersion, "%s: unexpected apiVersion", filePath)
	kind, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "kind")
	require.Equal(t, "Folder", kind, "%s: unexpected kind", filePath)

	uid, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
	require.NotEmpty(t, uid, "%s: should have a non-empty UID", filePath)
	title, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "spec", "title")
	require.NotEmpty(t, title, "%s: should have a non-empty title", filePath)

	_, err = h.Folders.Resource.Get(ctx, uid, metav1.GetOptions{})
	require.NoError(t, err, "%s: UID %q should resolve to an existing Grafana folder", filePath, uid)

	return uid, title
}

// writeFolderMetadata writes a syntactically valid _folder.json that
// references uid as the folder's name.  Used to plant a mismatched UID.
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

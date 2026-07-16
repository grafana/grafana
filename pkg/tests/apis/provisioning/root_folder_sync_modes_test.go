package provisioning

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// The two sync modes create root folders differently:
//
//   - folder mode (target: "folder"): a single wrapper folder is created whose
//     k8s name equals the repository name. Everything the repository syncs lives
//     under it. See resources.RootFolder / sync.FullSync.
//   - folderless mode (target: "folderless"): no wrapper folder is created. Each
//     top-level directory in the repository becomes a root folder on its own,
//     with an empty parent. Ownership is tracked purely via manager annotations.
//
// In both cases the root folders (parent == "") are created with the default
// manager annotations and are granted the default folder permissions. The
// grafana.app/grant-permissions annotation that provisioning stamps on root
// folders is consumed and cleared by the storage layer (it triggers the default
// permission grant), so these tests assert the observable outcome — the manager
// annotations on the stored folder and the default permissions readable via the
// folder permissions API — rather than the transient annotation itself.

// TestIntegrationProvisioning_RootFolder_FolderMode verifies that a repository
// synced in "folder" mode creates exactly one root folder named after the
// repository, with the default manager annotations and default permissions.
func TestIntegrationProvisioning_RootFolder_FolderMode(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "root-folder-mode"
	const repoTitle = "Git Sync Folder Mode"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		Title:      repoTitle,
		SyncTarget: "folder",
		Copies: map[string]string{
			// A dashboard at the repository root plus one inside a nested
			// directory. Folders created: the repo-named wrapper root folder and
			// the nested "team" child folder under it.
			"testdata/all-panels.json":    "dashboard.json",
			"testdata/timeline-demo.json": "team/dashboard.json",
		},
		ExpectedDashboards: 2,
		ExpectedFolders:    2,
	})

	// The root folder's k8s name is the repository name. Wait for it to be
	// created and settled (title, empty sourcePath, empty parent) before reading
	// it, so the assertions do not race the asynchronous sync.
	common.RequireFolderState(t, helper.Folders, repo, repoTitle, "", "")
	root := findManagedFolder(t, helper, repo, func(f *unstructured.Unstructured) bool {
		return f.GetName() == repo
	}, "root folder named after the repository")
	requireRootFolderManagerAnnotations(t, root, repo)

	// The default permissions must be granted on the root folder.
	common.RequireDefaultRootFolderPermissions(t, helper, repo)

	// The nested child folder is parented under the root, so it must NOT receive
	// the default permissions — those are granted on root-level folders only.
	child := findManagedFolderBySourcePath(t, helper, repo, "team")
	require.Equal(t, repo, child.GetAnnotations()[utils.AnnoKeyFolder],
		"nested folder should be parented under the repository root folder")
	common.RequireNoDefaultRootFolderPermissions(t, helper, child.GetName())
}

// TestIntegrationProvisioning_RootFolder_FolderlessMode verifies that a repository
// synced in "folderless" mode does NOT create a repo-named wrapper folder, and
// instead promotes each top-level directory to a root folder with the default
// manager annotations and default permissions.
func TestIntegrationProvisioning_RootFolder_FolderlessMode(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "root-folderless-mode"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folderless",
		Copies: map[string]string{
			// Two top-level directories — each becomes a root folder. The nested
			// "applications/nested" directory becomes a child folder under the
			// "applications" root. A dashboard at the repository root would stay
			// folderless (no folder annotation), but here every file is nested.
			"testdata/all-panels.json":    "applications/dashboard.json",
			"testdata/timeline-demo.json": "platform/dashboard.json",
			"testdata/text-options.json":  "applications/nested/dashboard.json",
		},
		ExpectedDashboards: 3,
		ExpectedFolders:    3,
	})

	// No wrapper folder named after the repository must exist in folderless mode.
	// CreateLocalRepo already waited for exactly ExpectedFolders to settle, so a
	// wrapper would have surfaced as an extra folder; this is a direct assertion.
	_, err := helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.Error(t, err, "folderless mode must not create a repo-named wrapper folder")

	// Each top-level directory becomes a root folder with default annotations and permissions.
	for _, sourcePath := range []string{"applications", "platform"} {
		folder := findManagedFolderBySourcePath(t, helper, repo, sourcePath)

		title, _, _ := unstructured.NestedString(folder.Object, "spec", "title")
		require.Equal(t, sourcePath, title,
			"folderless root folder title should default to the directory name")

		requireRootFolderManagerAnnotations(t, folder, repo)
		common.RequireDefaultRootFolderPermissions(t, helper, folder.GetName())
	}

	// The nested "applications/nested" folder is a child (parented under the
	// "applications" root), so it must NOT receive the default permissions.
	applications := findManagedFolderBySourcePath(t, helper, repo, "applications")
	child := findManagedFolderBySourcePath(t, helper, repo, "applications/nested")
	require.Equal(t, applications.GetName(), child.GetAnnotations()[utils.AnnoKeyFolder],
		"nested folder should be parented under the applications root folder")
	common.RequireNoDefaultRootFolderPermissions(t, helper, child.GetName())
}

// findManagedFolderBySourcePath returns the folder managed by repoName whose
// grafana.app/sourcePath annotation matches sourcePath. It waits until the
// folder appears because sync populates the resource asynchronously.
func findManagedFolderBySourcePath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) *unstructured.Unstructured {
	t.Helper()
	return findManagedFolder(t, helper, repoName, func(f *unstructured.Unstructured) bool {
		return f.GetAnnotations()[utils.AnnoKeySourcePath] == sourcePath
	}, fmt.Sprintf("sourcePath %q", sourcePath))
}

// findManagedFolder waits for and returns a folder managed by repoName that
// satisfies match. It polls with EventuallyWithT because sync populates folders
// asynchronously; the returned object is fully settled (annotations included),
// so callers can assert on it without racing. desc labels the match in failures.
func findManagedFolder(t *testing.T, helper *common.ProvisioningTestHelper, repoName string, match func(*unstructured.Unstructured) bool, desc string) *unstructured.Unstructured {
	t.Helper()
	var found *unstructured.Unstructured
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for i := range list.Items {
			if list.Items[i].GetAnnotations()[utils.AnnoKeyManagerIdentity] == repoName && match(&list.Items[i]) {
				found = &list.Items[i]
				return
			}
		}
		c.Errorf("no folder managed by %q matching %s found", repoName, desc)
	}, 30*time.Second, 100*time.Millisecond,
		"expected a folder managed by %q matching %s", repoName, desc)
	return found
}

// requireRootFolderManagerAnnotations asserts the default annotations a root
// folder receives on creation: repo manager ownership, no parent folder, and a
// cleared grant-permissions annotation (the storage layer consumes it to trigger
// the default permission grant). The folder must already be settled.
func requireRootFolderManagerAnnotations(t *testing.T, folder *unstructured.Unstructured, repo string) {
	t.Helper()
	ann := folder.GetAnnotations()
	require.Equal(t, string(utils.ManagerKindRepo), ann[utils.AnnoKeyManagerKind],
		"folder %q should be managed by a repository", folder.GetName())
	require.Equal(t, repo, ann[utils.AnnoKeyManagerIdentity],
		"folder %q should be managed by this repository", folder.GetName())
	require.Empty(t, ann[utils.AnnoKeyFolder],
		"root folder %q must have no parent folder", folder.GetName())
	require.Empty(t, ann[utils.AnnoKeyGrantPermissions],
		"grant-permissions annotation should be cleared after the default grant for %q", folder.GetName())
}

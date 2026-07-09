package provisioning

import (
	"encoding/json"
	"fmt"
	"net/http"
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

	// The root folder's k8s name is the repository name.
	root, err := helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.NoError(t, err, "folder mode should create a root folder named after the repository")

	title, _, _ := unstructured.NestedString(root.Object, "spec", "title")
	require.Equal(t, repoTitle, title, "root folder title should be the repository title")

	annotations := root.GetAnnotations()
	require.Equal(t, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind],
		"root folder should be managed by a repository")
	require.Equal(t, repo, annotations[utils.AnnoKeyManagerIdentity],
		"root folder should be managed by this repository")
	require.Empty(t, annotations[utils.AnnoKeySourcePath],
		"folder-mode root folder maps to the repository root, so sourcePath is empty")
	require.Empty(t, annotations[utils.AnnoKeyFolder],
		"folder-mode root folder has no parent folder")

	// The transient grant-permissions annotation must not survive on the stored
	// object — it is consumed by the storage layer to trigger the default grant.
	require.Empty(t, annotations[utils.AnnoKeyGrantPermissions],
		"grant-permissions annotation should be cleared after the default grant")

	// The default permissions must be granted on the root folder.
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	requireDefaultRootFolderPermissions(t, addr, repo)

	// The nested child folder is parented under the root, so it must NOT receive
	// the default permissions — those are granted on root-level folders only.
	child := findManagedFolderBySourcePath(t, helper, repo, "team")
	require.Equal(t, repo, child.GetAnnotations()[utils.AnnoKeyFolder],
		"nested folder should be parented under the repository root folder")
	requireNoDefaultRootFolderPermissions(t, addr, child.GetName())
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
	_, err := helper.Folders.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.Error(t, err, "folderless mode must not create a repo-named wrapper folder")

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	// Each top-level directory becomes a root folder with default annotations and permissions.
	for _, sourcePath := range []string{"applications", "platform"} {
		folder := findManagedFolderBySourcePath(t, helper, repo, sourcePath)

		title, _, _ := unstructured.NestedString(folder.Object, "spec", "title")
		require.Equal(t, sourcePath, title,
			"folderless root folder title should default to the directory name")

		annotations := folder.GetAnnotations()
		require.Equal(t, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind],
			"folder %q should be managed by a repository", sourcePath)
		require.Equal(t, repo, annotations[utils.AnnoKeyManagerIdentity],
			"folder %q should be managed by this repository", sourcePath)
		require.Empty(t, annotations[utils.AnnoKeyFolder],
			"folderless top-level folder %q must have no parent folder", sourcePath)
		require.Empty(t, annotations[utils.AnnoKeyGrantPermissions],
			"grant-permissions annotation should be cleared after the default grant for %q", sourcePath)

		requireDefaultRootFolderPermissions(t, addr, folder.GetName())
	}

	// The nested "applications/nested" folder is a child (parented under the
	// "applications" root), so it must NOT receive the default permissions.
	applications := findManagedFolderBySourcePath(t, helper, repo, "applications")
	child := findManagedFolderBySourcePath(t, helper, repo, "applications/nested")
	require.Equal(t, applications.GetName(), child.GetAnnotations()[utils.AnnoKeyFolder],
		"nested folder should be parented under the applications root folder")
	requireNoDefaultRootFolderPermissions(t, addr, child.GetName())
}

// findManagedFolderBySourcePath returns the folder managed by repoName whose
// grafana.app/sourcePath annotation matches sourcePath. It waits until the
// folder appears because sync populates the resource asynchronously.
func findManagedFolderBySourcePath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) *unstructured.Unstructured {
	t.Helper()
	var found *unstructured.Unstructured
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for i := range list.Items {
			ann := list.Items[i].GetAnnotations()
			if ann[utils.AnnoKeyManagerIdentity] == repoName && ann[utils.AnnoKeySourcePath] == sourcePath {
				found = &list.Items[i]
				return
			}
		}
		c.Errorf("no folder managed by %q with sourcePath %q found", repoName, sourcePath)
	}, 30*time.Second, 100*time.Millisecond,
		"expected a folder managed by %q at sourcePath %q", repoName, sourcePath)
	return found
}

// requireDefaultRootFolderPermissions asserts that a root folder carries the
// default role-based permissions granted on creation: Editor → Edit (2) and
// Viewer → View (1). The creator-admin grant depends on the caller identity
// type and is intentionally not asserted here.
func requireDefaultRootFolderPermissions(t *testing.T, addr, folderUID string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		perms := getFolderPermissions(c, addr, folderUID)
		assertPermissionContainsRole(c, perms, "Editor", 2)
		assertPermissionContainsRole(c, perms, "Viewer", 1)
	}, 30*time.Second, 100*time.Millisecond,
		"root folder %q should have default Editor/Viewer permissions", folderUID)
}

// requireNoDefaultRootFolderPermissions asserts that a folder was NOT granted
// the root-level default permissions. Default Editor/Viewer grants are applied
// only to root folders (empty parent); nested folders inherit access from their
// parent and carry no explicit default ACL. The GET endpoint returns a folder's
// own managed ACL entries (not inherited ones), so the defaults must be absent.
func requireNoDefaultRootFolderPermissions(t *testing.T, addr, folderUID string) {
	t.Helper()
	// A one-shot check is sufficient: the child folder was already confirmed to
	// exist (so sync processed it), and default permissions are never set on
	// nested folders — there is no later write that could add them.
	var perms []interface{}
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		perms = getFolderPermissions(c, addr, folderUID)
	}, 30*time.Second, 100*time.Millisecond, "should be able to read permissions for %q", folderUID)

	assertPermissionLacksRole(t, perms, "Editor", 2)
	assertPermissionLacksRole(t, perms, "Viewer", 1)
}

// getFolderPermissions reads the ACL entries for a folder via the legacy
// folder permissions API. It returns the decoded entries, or reports an error
// on the CollectT (so it can be used inside EventuallyWithT).
func getFolderPermissions(c *assert.CollectT, addr, folderUID string) []interface{} {
	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", addr, folderUID)
	resp, err := http.Get(u) //nolint:gosec
	if !assert.NoError(c, err, "GET folder permissions for %q", folderUID) {
		return nil
	}
	defer resp.Body.Close() //nolint:errcheck
	if !assert.Equal(c, http.StatusOK, resp.StatusCode, "unexpected status from permissions endpoint for %q", folderUID) {
		return nil
	}
	var perms []interface{}
	if !assert.NoError(c, json.NewDecoder(resp.Body).Decode(&perms), "decode permissions response for %q", folderUID) {
		return nil
	}
	return perms
}

// assertPermissionContainsRole asserts that perms contains at least one entry
// matching the given built-in role and numeric permission level. JSON numbers
// decode as float64, so the comparison is done via float64.
func assertPermissionContainsRole(c *assert.CollectT, perms []interface{}, expectedRole string, expectedPermission int) {
	for _, p := range perms {
		entry, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		role, _ := entry["role"].(string)
		level, _ := entry["permission"].(float64)
		if role == expectedRole && int(level) == expectedPermission {
			return
		}
	}
	c.Errorf("expected role=%q permission=%d in ACL entries; got: %v", expectedRole, expectedPermission, perms)
}

// assertPermissionLacksRole asserts that perms contains NO entry matching the
// given built-in role and numeric permission level.
func assertPermissionLacksRole(t *testing.T, perms []interface{}, role string, permission int) {
	t.Helper()
	for _, p := range perms {
		entry, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		r, _ := entry["role"].(string)
		level, _ := entry["permission"].(float64)
		require.Falsef(t, r == role && int(level) == permission,
			"did not expect default role=%q permission=%d on non-root folder; got: %v", role, permission, perms)
	}
}

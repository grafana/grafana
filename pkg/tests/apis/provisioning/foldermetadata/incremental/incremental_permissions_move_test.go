package incremental

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_IncrementalSync_FolderMovePermissions bundles all
// folder-move-preserves-permissions scenarios under a single Grafana + git server
// to avoid the cost of spinning up a new server per sub-case. Each scenario uses
// a distinct repo name and globally-unique folder UIDs so the subtests can share
// the same Grafana namespace without interfering with one another.
func TestIntegrationProvisioning_IncrementalSync_FolderMovePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := sharedGitHelper(t)
	ctx := context.Background()
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	// FolderMovePreservesPermissions verifies that custom permissions set on a
	// provisioned folder are preserved after the folder is moved to a different
	// location via git mv and an incremental sync is performed.
	t.Run("FolderMovePreservesPermissions", func(t *testing.T) {
		const repoName = "incr-move-perms"

		_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
			"teamA/_folder.json": folderMetadataJSON("team-a-uid", "Team A"),
			"teamB/_folder.json": folderMetadataJSON("team-b-uid", "Team B"),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		requireGitFolderState(t, helper, ctx, "team-a-uid", "Team A", "teamA", repoName)
		requireGitFolderState(t, helper, ctx, "team-b-uid", "Team B", "teamB", repoName)

		// Set a known ACL on teamA (check 4) so we can assert it is not touched when
		// a child folder is moved into it.
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
			"/api/folders/team-a-uid/permissions",
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Admin", "permission": 4},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on teamA folder should succeed")
		require.Equal(t, http.StatusOK, code)

		// Set multiple role-based ACL entries on teamB (check 3):
		// Viewer → View (1) and Editor → Edit (2).
		_, code, err = common.PostHelper(t, *helper.K8sTestHelper,
			"/api/folders/team-b-uid/permissions",
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Viewer", "permission": 1},
					{"role": "Editor", "permission": 2},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on teamB folder should succeed")
		require.Equal(t, http.StatusOK, code)

		// Snapshot permissions before the move and verify the expected entries are present.
		teamAPermsBefore := snapshotFolderPermissions(t, addr, "team-a-uid")
		requirePermissionsContainRole(t, teamAPermsBefore, "Admin", 4)

		teamBPermsBefore := snapshotFolderPermissions(t, addr, "team-b-uid")
		requirePermissionsContainRole(t, teamBPermsBefore, "Viewer", 1)
		requirePermissionsContainRole(t, teamBPermsBefore, "Editor", 2)

		// Move teamB inside teamA via git mv, commit, and push.
		_, err = local.Git("mv", "teamB", "teamA/teamB")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move teamB into teamA")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		// teamB should now live under teamA with the same stable UID.
		requireGitFolderState(t, helper, ctx, "team-b-uid", "Team B", "teamA/teamB", "team-a-uid")

		teamBPermsAfter := snapshotFolderPermissions(t, addr, "team-b-uid")

		// Check 1: The ACL entry count must not change after the move.
		require.Equal(t, len(teamBPermsBefore), len(teamBPermsAfter),
			"ACL entry count must not change after folder move")

		// Check 2 & 3: The full (role → permission) map must be identical before and after.
		requireRolePermissionSetEqual(t, teamBPermsBefore, teamBPermsAfter)
		requirePermissionsContainRole(t, teamBPermsAfter, "Viewer", 1)
		requirePermissionsContainRole(t, teamBPermsAfter, "Editor", 2)

		// Check 4: teamA's own ACL must be unaffected by moving a child into it.
		teamAPermsAfter := snapshotFolderPermissions(t, addr, "team-a-uid")
		requireRolePermissionSetEqual(t, teamAPermsBefore, teamAPermsAfter)

		// Check 5: The moved folder must still be effectively accessible to a user
		// carrying the granted role.
		requireFolderAccessible(t, addr, "team-b-uid", "viewer", "viewer")
	})

	// FolderMoveDoesNotPreservePermissionsForLegacyFolder contrasts with the
	// metadata test: a folder without _folder.json receives a brand-new UID when
	// its path changes (delete + recreate), so permissions associated with the
	// old UID are gone.
	t.Run("FolderMoveDoesNotPreservePermissionsForLegacyFolder", func(t *testing.T) {
		const repoName = "incr-move-legacy-perms"

		// Parent has stable metadata; the folder being moved does not.
		// plain has no _folder.json, so syncs will warn about missing metadata.
		_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json": folderMetadataJSON("parent-uid", "Parent"),
			"plain/.keep":         {},
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		requireGitFolderState(t, helper, ctx, "parent-uid", "Parent", "parent", repoName)
		plainUID := findGitFolderUIDBySourcePath(t, helper, ctx, repoName, "plain")
		require.NotEmpty(t, plainUID)

		// Set a Viewer permission on the legacy (no-metadata) folder.
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
			fmt.Sprintf("/api/folders/%s/permissions", plainUID),
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Viewer", "permission": 1},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on plain folder should succeed")
		require.Equal(t, http.StatusOK, code)

		plainPermsBefore := snapshotFolderPermissions(t, addr, plainUID)
		requirePermissionsContainRole(t, plainPermsBefore, "Viewer", 1)

		// Move the legacy folder under the parent via git mv, commit, and push.
		_, err = local.Git("mv", "plain", "parent/plain")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move plain folder under parent")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// parent/plain still has no _folder.json after the move, so the incremental
		// sync warns about missing metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// The old folder object must be gone — without metadata the path change
		// causes a delete-and-recreate rather than an in-place update.
		assertGitFolderAbsent(t, helper, ctx, plainUID)

		// The new folder at the moved path must exist with a different (hash-based) UID.
		newPlainUID := findGitFolderUIDBySourcePath(t, helper, ctx, repoName, "parent/plain")
		require.NotEmpty(t, newPlainUID)
		require.NotEqual(t, plainUID, newPlainUID,
			"legacy folder must get a new UID when its path changes")

		// The new folder must NOT carry the Viewer permission from the old object.
		newPlainPerms := snapshotFolderPermissions(t, addr, newPlainUID)
		for _, p := range newPlainPerms {
			entry, ok := p.(map[string]interface{})
			if !ok {
				continue
			}
			role, _ := entry["role"].(string)
			level, _ := entry["permission"].(float64)
			require.False(t, role == "Viewer" && int(level) == 1,
				"new legacy folder must not inherit Viewer permission from the deleted predecessor; got: %v", newPlainPerms)
		}
	})

	// NestedFolderMovePreservesPermissions verifies that permissions on a deeply
	// nested folder survive when its parent subtree is relocated. All folders in
	// the hierarchy carry _folder.json metadata, so UIDs are stable.
	t.Run("NestedFolderMovePreservesPermissions", func(t *testing.T) {
		const repoName = "incr-move-nested-perms"

		// Build root → child → grandchild; all have metadata so UIDs are stable.
		// destination also carries _folder.json so it doesn't trigger a missing-metadata warning.
		_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
			"root/_folder.json":                  folderMetadataJSON("root-uid", "Root"),
			"root/child/_folder.json":            folderMetadataJSON("child-uid", "Child"),
			"root/child/grandchild/_folder.json": folderMetadataJSON("grandchild-uid", "Grandchild"),
			"destination/_folder.json":           folderMetadataJSON("destination-uid", "Destination"),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		requireGitFolderState(t, helper, ctx, "root-uid", "Root", "root", repoName)
		requireGitFolderState(t, helper, ctx, "child-uid", "Child", "root/child", "root-uid")
		requireGitFolderState(t, helper, ctx, "grandchild-uid", "Grandchild", "root/child/grandchild", "child-uid")
		requireGitFolderState(t, helper, ctx, "destination-uid", "Destination", "destination", repoName)

		// Grant Editor permission on the deepest (grandchild) folder.
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
			"/api/folders/grandchild-uid/permissions",
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Editor", "permission": 2},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on grandchild folder should succeed")
		require.Equal(t, http.StatusOK, code)

		grandchildPermsBefore := snapshotFolderPermissions(t, addr, "grandchild-uid")
		requirePermissionsContainRole(t, grandchildPermsBefore, "Editor", 2)

		// Move the child subtree (carrying grandchild with it) under destination via git mv.
		_, err = local.Git("mv", "root/child", "destination/child")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move child subtree into destination")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		requireGitFolderState(t, helper, ctx, "destination-uid", "Destination", "destination", repoName)
		requireGitFolderState(t, helper, ctx, "child-uid", "Child", "destination/child", "destination-uid")
		requireGitFolderState(t, helper, ctx, "grandchild-uid", "Grandchild", "destination/child/grandchild", "child-uid")

		grandchildPermsAfter := snapshotFolderPermissions(t, addr, "grandchild-uid")
		require.Equal(t, len(grandchildPermsBefore), len(grandchildPermsAfter),
			"ACL entry count must not change after nested folder move")
		requireRolePermissionSetEqual(t, grandchildPermsBefore, grandchildPermsAfter)
		requirePermissionsContainRole(t, grandchildPermsAfter, "Editor", 2)
	})

	// RootToLeafMovePreservesPermissions verifies that a top-level (root) folder
	// moved to a deeply nested position retains its permissions.
	t.Run("RootToLeafMovePreservesPermissions", func(t *testing.T) {
		const repoName = "incr-move-root-to-leaf"

		_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
			"top/_folder.json":             folderMetadataJSON("top-uid", "Top"),
			"container/_folder.json":       folderMetadataJSON("container-uid", "Container"),
			"container/inner/_folder.json": folderMetadataJSON("inner-uid", "Inner"),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		requireGitFolderState(t, helper, ctx, "top-uid", "Top", "top", repoName)
		requireGitFolderState(t, helper, ctx, "container-uid", "Container", "container", repoName)
		requireGitFolderState(t, helper, ctx, "inner-uid", "Inner", "container/inner", "container-uid")

		// Grant Viewer permission on the root-level "top" folder before the move.
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
			"/api/folders/top-uid/permissions",
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Viewer", "permission": 1},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on top folder should succeed")
		require.Equal(t, http.StatusOK, code)

		topPermsBefore := snapshotFolderPermissions(t, addr, "top-uid")
		requirePermissionsContainRole(t, topPermsBefore, "Viewer", 1)

		// Move "top" under container/inner, making it a leaf three levels deep.
		_, err = local.Git("mv", "top", "container/inner/top")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move top folder to leaf position under container/inner")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		requireGitFolderState(t, helper, ctx, "top-uid", "Top", "container/inner/top", "inner-uid")

		topPermsAfter := snapshotFolderPermissions(t, addr, "top-uid")
		require.Equal(t, len(topPermsBefore), len(topPermsAfter),
			"ACL entry count must not change when moving a root folder to a leaf position")
		requireRolePermissionSetEqual(t, topPermsBefore, topPermsAfter)
		requirePermissionsContainRole(t, topPermsAfter, "Viewer", 1)
		requireFolderAccessible(t, addr, "top-uid", "viewer", "viewer")
	})

	// LeafToRootMovePreservesPermissions verifies that a deeply nested folder
	// promoted to the root level retains its permissions.
	// UIDs are prefixed with "ltroot-" to avoid collisions with the
	// FolderMoveDoesNotPreservePermissionsForLegacyFolder subtest above, which
	// also uses a folder named "parent" — UIDs must be globally unique in the
	// shared Grafana namespace.
	t.Run("LeafToRootMovePreservesPermissions", func(t *testing.T) {
		const repoName = "incr-move-leaf-to-root"

		_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
			"parent/_folder.json":           folderMetadataJSON("ltroot-parent-uid", "Parent"),
			"parent/deep/_folder.json":      folderMetadataJSON("ltroot-deep-uid", "Deep"),
			"parent/deep/leaf/_folder.json": folderMetadataJSON("ltroot-leaf-uid", "Leaf"),
		})

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		requireGitFolderState(t, helper, ctx, "ltroot-parent-uid", "Parent", "parent", repoName)
		requireGitFolderState(t, helper, ctx, "ltroot-deep-uid", "Deep", "parent/deep", "ltroot-parent-uid")
		requireGitFolderState(t, helper, ctx, "ltroot-leaf-uid", "Leaf", "parent/deep/leaf", "ltroot-deep-uid")

		// Grant Editor permission on the deeply nested leaf folder.
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
			"/api/folders/ltroot-leaf-uid/permissions",
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Editor", "permission": 2},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on leaf folder should succeed")
		require.Equal(t, http.StatusOK, code)

		leafPermsBefore := snapshotFolderPermissions(t, addr, "ltroot-leaf-uid")
		requirePermissionsContainRole(t, leafPermsBefore, "Editor", 2)

		// Promote the leaf to the repository root level via git mv.
		_, err = local.Git("mv", "parent/deep/leaf", "leaf")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "promote leaf folder to root level")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		requireGitFolderState(t, helper, ctx, "ltroot-leaf-uid", "Leaf", "leaf", repoName)

		leafPermsAfter := snapshotFolderPermissions(t, addr, "ltroot-leaf-uid")
		require.Equal(t, len(leafPermsBefore), len(leafPermsAfter),
			"ACL entry count must not change when a leaf folder is promoted to root")
		requireRolePermissionSetEqual(t, leafPermsBefore, leafPermsAfter)
		requirePermissionsContainRole(t, leafPermsAfter, "Editor", 2)
	})

	// MetadataFolderMovedUnderLegacyPreservesPermissions verifies that a folder
	// backed by _folder.json (stable UID, carries permissions) keeps its ACL when
	// it is moved under a folder that has no _folder.json (legacy, hash-based UID).
	t.Run("MetadataFolderMovedUnderLegacyPreservesPermissions", func(t *testing.T) {
		const repoName = "incr-move-meta-under-legacy"

		_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
			"child-with-meta/_folder.json": folderMetadataJSON("child-meta-uid", "Child With Meta"),
			"legacy-parent/.keep":          {},
		})

		// legacy-parent has no _folder.json, so the sync correctly warns about missing metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())

		requireGitFolderState(t, helper, ctx, "child-meta-uid", "Child With Meta", "child-with-meta", repoName)
		legacyParentUID := findGitFolderUIDBySourcePath(t, helper, ctx, repoName, "legacy-parent")
		require.NotEmpty(t, legacyParentUID)

		// Set Viewer permission on the metadata-backed child folder.
		_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
			"/api/folders/child-meta-uid/permissions",
			map[string]interface{}{
				"items": []map[string]interface{}{
					{"role": "Viewer", "permission": 1},
				},
			},
			helper.Org1.Admin)
		require.NoError(t, err, "setting permissions on child-with-meta folder should succeed")
		require.Equal(t, http.StatusOK, code)

		childPermsBefore := snapshotFolderPermissions(t, addr, "child-meta-uid")
		requirePermissionsContainRole(t, childPermsBefore, "Viewer", 1)

		// Move the metadata child under the legacy (no _folder.json) parent via git mv.
		_, err = local.Git("mv", "child-with-meta", "legacy-parent/child-with-meta")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move child-with-meta under legacy-parent")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		// After the move, legacy-parent still has no _folder.json, so the incremental sync
		// also warns about missing metadata.
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())

		// The legacy parent keeps its original hash-based UID (its path did not change).
		requireGitFolderState(t, helper, ctx, legacyParentUID, "legacy-parent", "legacy-parent", repoName)

		// The metadata child retains its stable UID and is now under the legacy parent.
		requireGitFolderState(t, helper, ctx, "child-meta-uid", "Child With Meta", "legacy-parent/child-with-meta", legacyParentUID)

		childPermsAfter := snapshotFolderPermissions(t, addr, "child-meta-uid")
		require.Equal(t, len(childPermsBefore), len(childPermsAfter),
			"ACL entry count must not change when metadata folder is moved under a legacy parent")
		requireRolePermissionSetEqual(t, childPermsBefore, childPermsAfter)
		requirePermissionsContainRole(t, childPermsAfter, "Viewer", 1)
		requireFolderAccessible(t, addr, "child-meta-uid", "viewer", "viewer")
	})
}

// requireGitFolderState asserts that a folder tracked by the gitTestHelper has the expected
// title, sourcePath annotation, and parent annotation. It polls until the state matches or the
// timeout expires, so it is safe to call immediately after triggering an incremental sync.
func requireGitFolderState(t *testing.T, h *common.GitTestHelper, ctx context.Context, folderUID, expectedTitle, expectedSourcePath, expectedParent string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := h.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get folder %s", folderUID) {
			return
		}

		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		assert.Equal(c, expectedTitle, title, "folder %s title", folderUID)

		annotations := obj.GetAnnotations()
		assert.Equal(c, expectedSourcePath, annotations["grafana.app/sourcePath"],
			"folder %s sourcePath", folderUID)
		assert.Equal(c, expectedParent, annotations["grafana.app/folder"],
			"folder %s parent", folderUID)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"folder %q should reach state: title=%q sourcePath=%q parent=%q",
		folderUID, expectedTitle, expectedSourcePath, expectedParent)
}

// findGitFolderUIDBySourcePath returns the UID of the folder managed by repoName at sourcePath.
// It polls until the folder appears or the timeout expires.
func findGitFolderUIDBySourcePath(t *testing.T, h *common.GitTestHelper, ctx context.Context, repoName, sourcePath string) string {
	t.Helper()
	var uid string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.Folders.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			annotations := f.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] == sourcePath {
				uid = f.GetName()
				return
			}
		}
		c.Errorf("no folder managed by %q with sourcePath %q found", repoName, sourcePath)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"expected folder with sourcePath %q for repo %q", sourcePath, repoName)
	return uid
}

// assertGitFolderAbsent asserts that the folder with the given UID no longer exists.
func assertGitFolderAbsent(t *testing.T, h *common.GitTestHelper, ctx context.Context, folderUID string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := h.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
		if err == nil {
			c.Errorf("folder %q still exists, expected NotFound", folderUID)
			return
		}
		assert.True(c, apierrors.IsNotFound(err),
			"expected NotFound error for folder %q, got: %v", folderUID, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "folder %q should be deleted", folderUID)
}

// snapshotFolderPermissions performs a single GET to /api/folders/{uid}/permissions and
// returns the raw decoded JSON array. The test fails immediately if the request errors.
func snapshotFolderPermissions(t *testing.T, addr, folderUID string) []interface{} {
	t.Helper()
	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", addr, folderUID)
	resp, err := http.Get(u) //nolint:gosec
	require.NoError(t, err, "GET folder permissions for %q", folderUID)
	defer resp.Body.Close() //nolint:errcheck
	require.Equal(t, http.StatusOK, resp.StatusCode,
		"unexpected status from permissions endpoint for %q", folderUID)
	var perms []interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&perms),
		"decode permissions response for %q", folderUID)
	return perms
}

// requirePermissionsContainRole asserts that perms contains at least one entry matching
// the given built-in role and numeric permission level.
// JSON numbers are decoded as float64, so the comparison is done via float64.
func requirePermissionsContainRole(t *testing.T, perms []interface{}, expectedRole string, expectedPermission int) {
	t.Helper()
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
	require.Failf(t, "permission not found",
		"expected role=%q permission=%d in ACL entries; got: %v",
		expectedRole, expectedPermission, perms)
}

// requireRolePermissionSetEqual asserts that the set of (role → permission) mappings is
// identical between want and got. Entry ordering and non-role fields (which may legitimately
// change after a move, such as internal parent-folder references) are ignored.
func requireRolePermissionSetEqual(t *testing.T, want, got []interface{}) {
	t.Helper()
	extractRoleMap := func(perms []interface{}) map[string]int {
		m := make(map[string]int)
		for _, p := range perms {
			entry, ok := p.(map[string]interface{})
			if !ok {
				continue
			}
			role, _ := entry["role"].(string)
			if role == "" {
				continue
			}
			level, _ := entry["permission"].(float64)
			m[role] = int(level)
		}
		return m
	}
	require.Equal(t, extractRoleMap(want), extractRoleMap(got),
		"role→permission map must be identical before and after the move")
}

// requireFolderAccessible asserts that GET /api/folders/{folderUID} returns HTTP 200
// when performed with the supplied Basic Auth credentials.
func requireFolderAccessible(t *testing.T, addr, folderUID, login, password string) {
	t.Helper()
	u := fmt.Sprintf("http://%s:%s@%s/api/folders/%s", login, password, addr, folderUID)
	resp, err := http.Get(u) //nolint:gosec
	require.NoError(t, err, "GET folder %q as user %q", folderUID, login)
	defer resp.Body.Close() //nolint:errcheck
	require.Equal(t, http.StatusOK, resp.StatusCode,
		"folder %q should be accessible to %q after the move", folderUID, login)
}

package moves

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_IncrementalSync_FolderMovePreservesPermissions verifies
// that custom permissions set on a provisioned folder are preserved after the folder is
// moved to a different location via git mv and an incremental sync is performed.
func TestIntegrationProvisioning_IncrementalSync_FolderMovePreservesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
	const repoName = "incr-move-perms"

	local := helper.CreateGitRepoWithFiles(t, repoName, map[string][]byte{
		"teamA/_folder.json": folderMetadataJSON("team-a-uid", "Team A"),
		"teamB/_folder.json": folderMetadataJSON("team-b-uid", "Team B"),
	})

	common.SyncAndWaitWithSuccess(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "team-a-uid", "Team A", "teamA", "")
	requireFolderState(t, helper.ProvisioningTestHelper, "team-b-uid", "Team B", "teamB", "")

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

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

	common.SyncAndWaitSuccessfulIncremental(t, helper, repoName)

	// teamB should now live under teamA with the same stable UID.
	requireFolderState(t, helper.ProvisioningTestHelper, "team-b-uid", "Team B", "teamA/teamB", "team-a-uid")

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
}

// TestIntegrationProvisioning_IncrementalSync_FolderMoveDoesNotPreservePermissionsForLegacyFolder
// contrasts with the metadata test: a folder without _folder.json receives a brand-new UID when
// its path changes (delete + recreate), so permissions associated with the old UID are gone.
func TestIntegrationProvisioning_IncrementalSync_FolderMoveDoesNotPreservePermissionsForLegacyFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
	const repoName = "incr-move-legacy-perms"

	// Parent has stable metadata; the folder being moved does not.
	// plain has no _folder.json, so syncs will warn about missing metadata.
	local := helper.CreateGitRepoWithFiles(t, repoName, map[string][]byte{
		"parent/_folder.json": folderMetadataJSON("parent-uid", "Parent"),
		"plain/.keep":         {},
	})

	common.SyncAndWaitWithWarning(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "parent-uid", "Parent", "parent", "")
	plainUID := findFolderUIDBySourcePath(t, helper.ProvisioningTestHelper, repoName, "plain")
	require.NotEmpty(t, plainUID)

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	// Set a Viewer permission on the legacy (no-metadata) folder.
	_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
		"/api/folders/"+plainUID+"/permissions",
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
	common.SyncAndWaitIncrementalWithWarning(t, helper, repoName)

	// The old folder object must be gone — without metadata the path change
	// causes a delete-and-recreate rather than an in-place update.
	assertNoFolderByUID(t, helper.ProvisioningTestHelper, plainUID)

	// The new folder at the moved path must exist with a different (hash-based) UID.
	newPlainUID := findFolderUIDBySourcePath(t, helper.ProvisioningTestHelper, repoName, "parent/plain")
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
}

// TestIntegrationProvisioning_IncrementalSync_NestedFolderMovePreservesPermissions verifies that
// permissions on a deeply nested folder survive when its parent subtree is relocated.
// All folders in the hierarchy carry _folder.json metadata, so UIDs are stable.
func TestIntegrationProvisioning_IncrementalSync_NestedFolderMovePreservesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
	const repoName = "incr-move-nested-perms"

	// Build root → child → grandchild; all have metadata so UIDs are stable.
	// destination also carries _folder.json so it doesn't trigger a missing-metadata warning.
	local := helper.CreateGitRepoWithFiles(t, repoName, map[string][]byte{
		"root/_folder.json":                  folderMetadataJSON("root-uid", "Root"),
		"root/child/_folder.json":            folderMetadataJSON("child-uid", "Child"),
		"root/child/grandchild/_folder.json": folderMetadataJSON("grandchild-uid", "Grandchild"),
		"destination/_folder.json":           folderMetadataJSON("destination-uid", "Destination"),
	})

	common.SyncAndWaitWithSuccess(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "root-uid", "Root", "root", "")
	requireFolderState(t, helper.ProvisioningTestHelper, "child-uid", "Child", "root/child", "root-uid")
	requireFolderState(t, helper.ProvisioningTestHelper, "grandchild-uid", "Grandchild", "root/child/grandchild", "child-uid")
	requireFolderState(t, helper.ProvisioningTestHelper, "destination-uid", "Destination", "destination", "")

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

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

	common.SyncAndWaitSuccessfulIncremental(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "destination-uid", "Destination", "destination", "")
	requireFolderState(t, helper.ProvisioningTestHelper, "child-uid", "Child", "destination/child", "destination-uid")
	requireFolderState(t, helper.ProvisioningTestHelper, "grandchild-uid", "Grandchild", "destination/child/grandchild", "child-uid")

	grandchildPermsAfter := snapshotFolderPermissions(t, addr, "grandchild-uid")
	require.Equal(t, len(grandchildPermsBefore), len(grandchildPermsAfter),
		"ACL entry count must not change after nested folder move")
	requireRolePermissionSetEqual(t, grandchildPermsBefore, grandchildPermsAfter)
	requirePermissionsContainRole(t, grandchildPermsAfter, "Editor", 2)
}

// TestIntegrationProvisioning_IncrementalSync_RootToLeafMovePreservesPermissions verifies that
// a top-level (root) folder that is moved to a deeply nested position retains its permissions.
func TestIntegrationProvisioning_IncrementalSync_RootToLeafMovePreservesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
	const repoName = "incr-move-root-to-leaf"

	local := helper.CreateGitRepoWithFiles(t, repoName, map[string][]byte{
		"top/_folder.json":             folderMetadataJSON("top-uid", "Top"),
		"container/_folder.json":       folderMetadataJSON("container-uid", "Container"),
		"container/inner/_folder.json": folderMetadataJSON("inner-uid", "Inner"),
	})

	common.SyncAndWaitWithSuccess(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "top-uid", "Top", "top", "")
	requireFolderState(t, helper.ProvisioningTestHelper, "container-uid", "Container", "container", "")
	requireFolderState(t, helper.ProvisioningTestHelper, "inner-uid", "Inner", "container/inner", "container-uid")

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

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
	_, err = local.Git("commit", "-m", "move top folder to leaf position")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWaitSuccessfulIncremental(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "top-uid", "Top", "container/inner/top", "inner-uid")

	topPermsAfter := snapshotFolderPermissions(t, addr, "top-uid")
	require.Equal(t, len(topPermsBefore), len(topPermsAfter),
		"ACL entry count must not change when moving a root folder to a leaf position")
	requireRolePermissionSetEqual(t, topPermsBefore, topPermsAfter)
	requirePermissionsContainRole(t, topPermsAfter, "Viewer", 1)
	requireFolderAccessible(t, addr, "top-uid", "viewer", "viewer")
}

// TestIntegrationProvisioning_IncrementalSync_LeafToRootMovePreservesPermissions verifies that
// a deeply nested folder promoted to the root level retains its permissions.
func TestIntegrationProvisioning_IncrementalSync_LeafToRootMovePreservesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
	const repoName = "incr-move-leaf-to-root"

	local := helper.CreateGitRepoWithFiles(t, repoName, map[string][]byte{
		"parent/_folder.json":           folderMetadataJSON("parent-uid", "Parent"),
		"parent/deep/_folder.json":      folderMetadataJSON("deep-uid", "Deep"),
		"parent/deep/leaf/_folder.json": folderMetadataJSON("leaf-uid", "Leaf"),
	})

	common.SyncAndWaitWithSuccess(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "parent-uid", "Parent", "parent", "")
	requireFolderState(t, helper.ProvisioningTestHelper, "deep-uid", "Deep", "parent/deep", "parent-uid")
	requireFolderState(t, helper.ProvisioningTestHelper, "leaf-uid", "Leaf", "parent/deep/leaf", "deep-uid")

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	// Grant Editor permission on the deeply nested leaf folder.
	_, code, err := common.PostHelper(t, *helper.K8sTestHelper,
		"/api/folders/leaf-uid/permissions",
		map[string]interface{}{
			"items": []map[string]interface{}{
				{"role": "Editor", "permission": 2},
			},
		},
		helper.Org1.Admin)
	require.NoError(t, err, "setting permissions on leaf folder should succeed")
	require.Equal(t, http.StatusOK, code)

	leafPermsBefore := snapshotFolderPermissions(t, addr, "leaf-uid")
	requirePermissionsContainRole(t, leafPermsBefore, "Editor", 2)

	// Promote the leaf to the repository root level via git mv.
	_, err = local.Git("mv", "parent/deep/leaf", "leaf")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "promote leaf folder to root level")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWaitSuccessfulIncremental(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "leaf-uid", "Leaf", "leaf", "")

	leafPermsAfter := snapshotFolderPermissions(t, addr, "leaf-uid")
	require.Equal(t, len(leafPermsBefore), len(leafPermsAfter),
		"ACL entry count must not change when a leaf folder is promoted to root")
	requireRolePermissionSetEqual(t, leafPermsBefore, leafPermsAfter)
	requirePermissionsContainRole(t, leafPermsAfter, "Editor", 2)
}

// TestIntegrationProvisioning_IncrementalSync_MetadataFolderMovedUnderLegacyPreservesPermissions
// verifies that a folder backed by _folder.json (stable UID, carries permissions) keeps
// its ACL when it is moved under a folder that has no _folder.json (legacy, hash-based UID).
func TestIntegrationProvisioning_IncrementalSync_MetadataFolderMovedUnderLegacyPreservesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafanaWithGitServerForExport(t, common.WithProvisioningFolderMetadata)
	const repoName = "incr-move-meta-under-legacy"

	local := helper.CreateGitRepoWithFiles(t, repoName, map[string][]byte{
		"child-with-meta/_folder.json": folderMetadataJSON("child-meta-uid", "Child With Meta"),
		"legacy-parent/.keep":          {},
	})

	// legacy-parent has no _folder.json, so the sync correctly warns about missing metadata.
	common.SyncAndWaitWithWarning(t, helper, repoName)

	requireFolderState(t, helper.ProvisioningTestHelper, "child-meta-uid", "Child With Meta", "child-with-meta", "")
	legacyParentUID := findFolderUIDBySourcePath(t, helper.ProvisioningTestHelper, repoName, "legacy-parent")
	require.NotEmpty(t, legacyParentUID)

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

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
	common.SyncAndWaitIncrementalWithWarning(t, helper, repoName)

	// The legacy parent keeps its original hash-based UID (its path did not change).
	requireFolderState(t, helper.ProvisioningTestHelper, legacyParentUID, "legacy-parent", "legacy-parent", "")

	// The metadata child retains its stable UID and is now under the legacy parent.
	requireFolderState(t, helper.ProvisioningTestHelper, "child-meta-uid", "Child With Meta", "legacy-parent/child-with-meta", legacyParentUID)

	childPermsAfter := snapshotFolderPermissions(t, addr, "child-meta-uid")
	require.Equal(t, len(childPermsBefore), len(childPermsAfter),
		"ACL entry count must not change when metadata folder is moved under a legacy parent")
	requireRolePermissionSetEqual(t, childPermsBefore, childPermsAfter)
	requirePermissionsContainRole(t, childPermsAfter, "Viewer", 1)
	requireFolderAccessible(t, addr, "child-meta-uid", "viewer", "viewer")
}

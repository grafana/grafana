package foldermetadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_FolderMovePreservesPermissions verifies that
// custom permissions set on a provisioned folder are preserved after the folder is
// moved to a different location in the repository tree and a full sync is performed.
func TestIntegrationProvisioning_FullSync_FolderMovePreservesPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-move-perms"

	writeToProvisioningPath(t, helper, "teamA/_folder.json", folderMetadataJSON("team-a-uid", "Team A"))
	writeToProvisioningPath(t, helper, "teamB/_folder.json", folderMetadataJSON("team-b-uid", "Team B"))

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	common.RequireFolderState(t, helper.Folders, "team-a-uid", "Team A", "teamA", repo)
	common.RequireFolderState(t, helper.Folders, "team-b-uid", "Team B", "teamB", repo)

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
	// The GET endpoint returns only explicitly-managed ACL entries, so this also
	// confirms the POSTs were actually persisted and are readable via the API.
	teamAPermsBefore := snapshotFolderPermissions(t, addr, "team-a-uid")
	requirePermissionsContainRole(t, teamAPermsBefore, "Admin", 4)

	teamBPermsBefore := snapshotFolderPermissions(t, addr, "team-b-uid")
	requirePermissionsContainRole(t, teamBPermsBefore, "Viewer", 1)
	requirePermissionsContainRole(t, teamBPermsBefore, "Editor", 2)

	// Move teamB inside teamA and trigger a sync.
	moveInProvisioningPath(t, helper, "teamB", "teamA/teamB")
	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	// teamB should now live under teamA with the same stable UID.
	common.RequireFolderState(t, helper.Folders, "team-b-uid", "Team B", "teamA/teamB", "team-a-uid")

	teamBPermsAfter := snapshotFolderPermissions(t, addr, "team-b-uid")

	// Check 1: The ACL entry count must not change after the move.
	require.Equal(t, len(teamBPermsBefore), len(teamBPermsAfter),
		"ACL entry count must not change after folder move")

	// Check 2 & 3: The full (role → permission) map must be identical before and after.
	// This verifies all entries (Viewer and Editor) survive the move.
	requireRolePermissionSetEqual(t, teamBPermsBefore, teamBPermsAfter)
	requirePermissionsContainRole(t, teamBPermsAfter, "Viewer", 1)
	requirePermissionsContainRole(t, teamBPermsAfter, "Editor", 2)

	// Check 4: teamA's own ACL must be unaffected by moving a child into it.
	teamAPermsAfter := snapshotFolderPermissions(t, addr, "team-a-uid")
	requireRolePermissionSetEqual(t, teamAPermsBefore, teamAPermsAfter)

	// Check 5: The moved folder must still be effectively accessible to a user
	// carrying the granted role. The Viewer org role was granted explicit view access
	// on teamB; after the move a request authenticated as that user must still get 200.
	requireFolderAccessible(t, addr, "team-b-uid", "viewer", "viewer")
}

// TestIntegrationProvisioning_FullSync_FolderMoveDoesNotPreservePermissionsForLegacyFolder
// contrasts with TestIntegrationProvisioning_FullSync_FolderMovePreservesPermissions: a folder
// without _folder.json receives a brand-new UID when its path changes (delete + recreate),
// so permissions associated with the old UID are gone after the move. There is no surviving
// object to carry them.
func TestIntegrationProvisioning_FullSync_FolderMoveDoesNotPreservePermissionsForLegacyFolder(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-move-legacy-perms"

	// Parent has stable metadata; the folder being moved does not.
	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
	writeToProvisioningPath(t, helper, "plain/.keep", []byte{})

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Initial sync warns because "plain" is a legacy folder (tracked via .keep)
	// with no _folder.json metadata.
	common.SyncAndWait(t, helper, common.Repo(repo), common.Warning())

	common.RequireFolderState(t, helper.Folders, "parent-uid", "Parent", "parent", repo)
	plainUID := findFolderUIDBySourcePath(t, helper, repo, "plain")
	require.NotEmpty(t, plainUID)

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	// Set a Viewer permission on the legacy (no-metadata) folder.
	// With the FlagProvisioningFolderMetadata feature enabled, this is allowed.
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

	// Move the legacy folder under the parent and sync.
	moveInProvisioningPath(t, helper, "plain", "parent/plain")
	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	// The old folder object must be gone — without metadata the path change
	// causes a delete-and-recreate rather than an in-place update.
	assertNoFolderByUID(t, helper, plainUID)

	// The new folder at the moved path must exist with a different (hash-based) UID.
	newPlainUID := findFolderUIDBySourcePath(t, helper, repo, "parent/plain")
	require.NotEmpty(t, newPlainUID)
	require.NotEqual(t, plainUID, newPlainUID,
		"legacy folder must get a new UID when its path changes")

	// The new folder must NOT carry the Viewer permission from the old object.
	// It is a brand-new resource; the old ACL entries do not transfer.
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

// TestIntegrationProvisioning_FullSync_NestedFolderMovePreservesPermissions verifies that
// permissions on a deeply nested folder survive when its parent subtree is relocated.
// All folders in the hierarchy carry _folder.json metadata, so UIDs are stable.
func TestIntegrationProvisioning_FullSync_NestedFolderMovePreservesPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-move-nested-perms"

	// Build root → child → grandchild; all have metadata so UIDs are stable.
	writeToProvisioningPath(t, helper, "root/_folder.json", folderMetadataJSON("root-uid", "Root"))
	writeToProvisioningPath(t, helper, "root/child/_folder.json", folderMetadataJSON("child-uid", "Child"))
	writeToProvisioningPath(t, helper, "root/child/grandchild/_folder.json", folderMetadataJSON("grandchild-uid", "Grandchild"))
	writeToProvisioningPath(t, helper, "destination/.keep", []byte{})

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Initial sync warns because "destination" is a legacy folder (tracked via .keep)
	// with no _folder.json metadata.
	common.SyncAndWait(t, helper, common.Repo(repo), common.Warning())

	common.RequireFolderState(t, helper.Folders, "root-uid", "Root", "root", repo)
	common.RequireFolderState(t, helper.Folders, "child-uid", "Child", "root/child", "root-uid")
	common.RequireFolderState(t, helper.Folders, "grandchild-uid", "Grandchild", "root/child/grandchild", "child-uid")

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

	// Move the child subtree (carrying grandchild with it) under destination.
	moveInProvisioningPath(t, helper, "root/child", "destination/child")
	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	destUID := findFolderUIDBySourcePath(t, helper, repo, "destination")
	require.NotEmpty(t, destUID)
	common.RequireFolderState(t, helper.Folders, "child-uid", "Child", "destination/child", destUID)
	common.RequireFolderState(t, helper.Folders, "grandchild-uid", "Grandchild", "destination/child/grandchild", "child-uid")

	grandchildPermsAfter := snapshotFolderPermissions(t, addr, "grandchild-uid")
	require.Equal(t, len(grandchildPermsBefore), len(grandchildPermsAfter),
		"ACL entry count must not change after nested folder move")
	requireRolePermissionSetEqual(t, grandchildPermsBefore, grandchildPermsAfter)
	requirePermissionsContainRole(t, grandchildPermsAfter, "Editor", 2)
}

// TestIntegrationProvisioning_FullSync_RootToLeafMovePreservesPermissions verifies that
// a top-level (root) folder that is moved to a deeply nested position retains its permissions.
func TestIntegrationProvisioning_FullSync_RootToLeafMovePreservesPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-move-root-to-leaf"

	writeToProvisioningPath(t, helper, "top/_folder.json", folderMetadataJSON("top-uid", "Top"))
	writeToProvisioningPath(t, helper, "container/_folder.json", folderMetadataJSON("container-uid", "Container"))
	writeToProvisioningPath(t, helper, "container/inner/_folder.json", folderMetadataJSON("inner-uid", "Inner"))

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	common.RequireFolderState(t, helper.Folders, "top-uid", "Top", "top", repo)
	common.RequireFolderState(t, helper.Folders, "container-uid", "Container", "container", repo)
	common.RequireFolderState(t, helper.Folders, "inner-uid", "Inner", "container/inner", "container-uid")

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
	moveInProvisioningPath(t, helper, "top", "container/inner/top")
	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	common.RequireFolderState(t, helper.Folders, "top-uid", "Top", "container/inner/top", "inner-uid")

	topPermsAfter := snapshotFolderPermissions(t, addr, "top-uid")
	require.Equal(t, len(topPermsBefore), len(topPermsAfter),
		"ACL entry count must not change when moving a root folder to a leaf position")
	requireRolePermissionSetEqual(t, topPermsBefore, topPermsAfter)
	requirePermissionsContainRole(t, topPermsAfter, "Viewer", 1)
	requireFolderAccessible(t, addr, "top-uid", "viewer", "viewer")
}

// TestIntegrationProvisioning_FullSync_LeafToRootMovePreservesPermissions verifies that
// a deeply nested folder promoted to the root level retains its permissions.
func TestIntegrationProvisioning_FullSync_LeafToRootMovePreservesPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-move-leaf-to-root"

	writeToProvisioningPath(t, helper, "parent/_folder.json", folderMetadataJSON("parent-uid", "Parent"))
	writeToProvisioningPath(t, helper, "parent/deep/_folder.json", folderMetadataJSON("deep-uid", "Deep"))
	writeToProvisioningPath(t, helper, "parent/deep/leaf/_folder.json", folderMetadataJSON("leaf-uid", "Leaf"))

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	common.RequireFolderState(t, helper.Folders, "parent-uid", "Parent", "parent", repo)
	common.RequireFolderState(t, helper.Folders, "deep-uid", "Deep", "parent/deep", "parent-uid")
	common.RequireFolderState(t, helper.Folders, "leaf-uid", "Leaf", "parent/deep/leaf", "deep-uid")

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

	// Promote the leaf to the repository root level.
	moveInProvisioningPath(t, helper, "parent/deep/leaf", "leaf")
	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	common.RequireFolderState(t, helper.Folders, "leaf-uid", "Leaf", "leaf", repo)

	leafPermsAfter := snapshotFolderPermissions(t, addr, "leaf-uid")
	require.Equal(t, len(leafPermsBefore), len(leafPermsAfter),
		"ACL entry count must not change when a leaf folder is promoted to root")
	requireRolePermissionSetEqual(t, leafPermsBefore, leafPermsAfter)
	requirePermissionsContainRole(t, leafPermsAfter, "Editor", 2)
}

// TestIntegrationProvisioning_FullSync_MetadataFolderMovedUnderLegacyPreservesPermissions
// verifies that a folder backed by _folder.json (stable UID, carries permissions) keeps
// its ACL when it is moved under a folder that has no _folder.json (legacy, hash-based UID).
// The legacy parent keeps the same hash-based UID because its own path does not change;
// only the child is re-parented.
func TestIntegrationProvisioning_FullSync_MetadataFolderMovedUnderLegacyPreservesPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-move-meta-under-legacy"

	writeToProvisioningPath(t, helper, "child-with-meta/_folder.json", folderMetadataJSON("child-meta-uid", "Child With Meta"))
	writeToProvisioningPath(t, helper, "legacy-parent/.keep", []byte{})

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Initial sync warns because "legacy-parent" is a legacy folder (tracked via .keep)
	// with no _folder.json metadata.
	common.SyncAndWait(t, helper, common.Repo(repo), common.Warning())

	common.RequireFolderState(t, helper.Folders, "child-meta-uid", "Child With Meta", "child-with-meta", repo)
	legacyParentUID := findFolderUIDBySourcePath(t, helper, repo, "legacy-parent")
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

	// Move the metadata child under the legacy (no _folder.json) parent.
	// The legacy parent's path does not change so its UID remains stable.
	moveInProvisioningPath(t, helper, "child-with-meta", "legacy-parent/child-with-meta")
	common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

	// The legacy parent keeps its original hash-based UID.
	common.RequireFolderState(t, helper.Folders, legacyParentUID, "legacy-parent", "legacy-parent", repo)

	// The metadata child retains its stable UID and is now under the legacy parent.
	common.RequireFolderState(t, helper.Folders, "child-meta-uid", "Child With Meta", "legacy-parent/child-with-meta", legacyParentUID)

	childPermsAfter := snapshotFolderPermissions(t, addr, "child-meta-uid")
	require.Equal(t, len(childPermsBefore), len(childPermsAfter),
		"ACL entry count must not change when metadata folder is moved under a legacy parent")
	requireRolePermissionSetEqual(t, childPermsBefore, childPermsAfter)
	requirePermissionsContainRole(t, childPermsAfter, "Viewer", 1)
	requireFolderAccessible(t, addr, "child-meta-uid", "viewer", "viewer")
}

// snapshotFolderPermissions performs a single GET to /api/folders/{uid}/permissions
// and returns the raw decoded JSON array. The test fails immediately if the request
// itself errors out, but an empty array is a valid (non-error) response.
func snapshotFolderPermissions(t *testing.T, addr, folderUID string) []interface{} {
	t.Helper()
	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", addr, folderUID)
	resp, err := http.Get(u) //nolint:gosec
	require.NoError(t, err, "GET folder permissions for %q", folderUID)
	defer resp.Body.Close() //nolint:errcheck
	require.Equal(t, http.StatusOK, resp.StatusCode, "unexpected status from permissions endpoint for %q", folderUID)
	var perms []interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&perms), "decode permissions response for %q", folderUID)
	return perms
}

// requirePermissionsContainRole asserts that perms contains at least one entry
// matching the given built-in role and numeric permission level.
// JSON numbers are decoded as float64, so the comparison is done via float64.
func requirePermissionsContainRole(t *testing.T, perms []interface{}, expectedRole string, expectedPermission int) {
	t.Helper()
	for _, p := range perms {
		entry, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		role, _ := entry["role"].(string)
		// JSON numbers unmarshal as float64.
		level, _ := entry["permission"].(float64)
		if role == expectedRole && int(level) == expectedPermission {
			return
		}
	}
	require.Failf(t, "permission not found",
		"expected role=%q permission=%d in ACL entries; got: %v", expectedRole, expectedPermission, perms)
}

// requireRolePermissionSetEqual asserts that the set of (role → permission) mappings
// is identical between want and got. Entry ordering and non-role fields (which may
// legitimately change after a move, such as internal parent-folder references) are ignored.
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
// when performed with the supplied Basic Auth credentials. This exercises real
// authorization logic, not just the stored ACL data.
func requireFolderAccessible(t *testing.T, addr, folderUID, login, password string) {
	t.Helper()
	u := fmt.Sprintf("http://%s:%s@%s/api/folders/%s", login, password, addr, folderUID)
	resp, err := http.Get(u) //nolint:gosec
	require.NoError(t, err, "GET folder %q as user %q", folderUID, login)
	defer resp.Body.Close() //nolint:errcheck
	require.Equal(t, http.StatusOK, resp.StatusCode,
		"folder %q should be accessible to %q after the move", folderUID, login)
}

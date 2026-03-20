package foldermetadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_FullSync_FolderMovePreservesPermissions verifies that
// custom permissions set on a provisioned folder (with folder metadata enabled) are
// preserved after the folder is moved to a different location in the repository tree
// and a full sync is performed.
func TestIntegrationProvisioning_FullSync_FolderMovePreservesPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
	const repo = "folder-move-perms"

	// _folder.json alone is not enough to trigger folder creation during sync
	// (those files are skipped in the sync change-list). A .keep file ensures the
	// directory is treated as an empty folder and gets provisioned correctly.
	writeToProvisioningPath(t, helper, "teamA/_folder.json", folderMetadataJSON("team-a-uid", "Team A"))
	writeToProvisioningPath(t, helper, "teamA/.keep", []byte{})
	writeToProvisioningPath(t, helper, "teamB/_folder.json", folderMetadataJSON("team-b-uid", "Team B"))
	writeToProvisioningPath(t, helper, "teamB/.keep", []byte{})

	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	helper.SyncAndWait(t, repo, nil)

	requireFolderState(t, helper, "team-a-uid", "Team A", "teamA", repo)
	requireFolderState(t, helper, "team-b-uid", "Team B", "teamB", repo)

	// Assign "Viewer" role view permission to the teamB folder.
	// With the FlagProvisioningFolderMetadata feature enabled, permission updates
	// on provisioned folders are allowed.
	permissionsPayload := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"role":       "Viewer",
				"permission": 1,
			},
		},
	}
	permissionsURL := fmt.Sprintf("/api/folders/%s/permissions", "team-b-uid")
	_, code, err := common.PostHelper(t, *helper.K8sTestHelper, permissionsURL, permissionsPayload, helper.Org1.Admin)
	require.NoError(t, err, "setting permissions on teamB folder should succeed")
	require.Equal(t, http.StatusOK, code)

	// Snapshot permissions before the move and verify the Viewer entry is present.
	// The GET endpoint returns only explicitly-managed ACL entries, so this also
	// confirms the POST was actually persisted and is readable via the API.
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	permsBefore := snapshotFolderPermissions(t, addr, "team-b-uid")
	requirePermissionsContainRole(t, permsBefore, "Viewer", 1)

	// Move teamB inside teamA and trigger a sync.
	moveInProvisioningPath(t, helper, "teamB", "teamA/teamB")
	helper.SyncAndWait(t, repo, nil)

	// teamB should now live under teamA with the same stable UID.
	requireFolderState(t, helper, "team-b-uid", "Team B", "teamA/teamB", "team-a-uid")

	// The ACL entries must still be present after the move. Fields like
	// folderUid legitimately reflect the new parent after the move, so we
	// cannot do a full equality comparison — instead verify the role is still there.
	permsAfter := snapshotFolderPermissions(t, addr, "team-b-uid")
	requirePermissionsContainRole(t, permsAfter, "Viewer", 1)
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

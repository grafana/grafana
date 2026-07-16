package common

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Folder permission levels as returned/accepted by the legacy folder
// permissions API (/api/folders/{uid}/permissions).
const (
	FolderPermissionView  = 1
	FolderPermissionEdit  = 2
	FolderPermissionAdmin = 4
)

// FolderPermissions fetches the managed ACL entries for a folder via the legacy
// folder permissions API using admin credentials. It fails the test if the
// request does not return 200. The entries are returned as decoded JSON objects
// (the endpoint returns more fields than the assertions here inspect).
func FolderPermissions(t *testing.T, helper *ProvisioningTestHelper, folderUID string) []interface{} {
	t.Helper()
	perms, code, err := fetchFolderPermissions(folderAddr(helper), folderUID)
	require.NoError(t, err, "GET folder permissions for %q", folderUID)
	require.Equal(t, http.StatusOK, code, "unexpected status from permissions endpoint for %q", folderUID)
	return perms
}

// RequirePermissionContainsRole asserts that perms contains at least one entry
// matching the given built-in role and numeric permission level.
func RequirePermissionContainsRole(t *testing.T, perms []interface{}, role string, permission int) {
	t.Helper()
	require.Truef(t, permissionsContainRole(perms, role, permission),
		"expected role=%q permission=%d in ACL entries; got: %v", role, permission, perms)
}

// RequirePermissionLacksRole asserts that perms contains NO entry matching the
// given built-in role and numeric permission level.
func RequirePermissionLacksRole(t *testing.T, perms []interface{}, role string, permission int) {
	t.Helper()
	require.Falsef(t, permissionsContainRole(perms, role, permission),
		"did not expect role=%q permission=%d in ACL entries; got: %v", role, permission, perms)
}

// RequireDefaultRootFolderPermissions asserts that a root folder carries the
// default role-based permissions granted on creation: Editor → Edit and
// Viewer → View. It waits because permissions are applied asynchronously after
// the folder is created. The creator-admin grant depends on the caller identity
// type and is intentionally not asserted here.
func RequireDefaultRootFolderPermissions(t *testing.T, helper *ProvisioningTestHelper, folderUID string) {
	t.Helper()
	addr := folderAddr(helper)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		perms, code, err := fetchFolderPermissions(addr, folderUID)
		if !assert.NoError(c, err, "GET folder permissions for %q", folderUID) {
			return
		}
		if !assert.Equal(c, http.StatusOK, code, "unexpected status for %q", folderUID) {
			return
		}
		assert.Truef(c, permissionsContainRole(perms, "Editor", FolderPermissionEdit),
			"expected Editor→Edit in ACL for %q; got: %v", folderUID, perms)
		assert.Truef(c, permissionsContainRole(perms, "Viewer", FolderPermissionView),
			"expected Viewer→View in ACL for %q; got: %v", folderUID, perms)
	}, 30*time.Second, 100*time.Millisecond,
		"root folder %q should have default Editor/Viewer permissions", folderUID)
}

// RequireNoDefaultRootFolderPermissions asserts that a folder was NOT granted
// the root-level default permissions. Default Editor/Viewer grants are applied
// only to root folders (empty parent); nested folders inherit access from their
// parent and carry no explicit default ACL. The GET endpoint returns a folder's
// own managed ACL entries (not inherited ones), so the defaults must be absent.
//
// The caller must have already confirmed the folder exists (e.g. via a folder
// wait helper): default permissions are never set on nested folders, so once the
// folder is present a single read is authoritative.
func RequireNoDefaultRootFolderPermissions(t *testing.T, helper *ProvisioningTestHelper, folderUID string) {
	t.Helper()
	perms := FolderPermissions(t, helper, folderUID)
	RequirePermissionLacksRole(t, perms, "Editor", FolderPermissionEdit)
	RequirePermissionLacksRole(t, perms, "Viewer", FolderPermissionView)
}

// folderAddr returns the host:port of the running test server.
func folderAddr(helper *ProvisioningTestHelper) string {
	return helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
}

// fetchFolderPermissions performs the raw GET against the legacy folder
// permissions API and decodes the ACL entries.
func fetchFolderPermissions(addr, folderUID string) ([]interface{}, int, error) {
	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", addr, folderUID)
	resp, err := http.Get(u) //nolint:gosec
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close() //nolint:errcheck
	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}
	var perms []interface{}
	if err := json.NewDecoder(resp.Body).Decode(&perms); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("decode permissions response for %q: %w", folderUID, err)
	}
	return perms, resp.StatusCode, nil
}

// permissionsContainRole reports whether perms has an entry matching the given
// built-in role and numeric permission level. JSON numbers decode as float64.
func permissionsContainRole(perms []interface{}, role string, permission int) bool {
	for _, p := range perms {
		entry, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		r, _ := entry["role"].(string)
		level, _ := entry["permission"].(float64)
		if r == role && int(level) == permission {
			return true
		}
	}
	return false
}

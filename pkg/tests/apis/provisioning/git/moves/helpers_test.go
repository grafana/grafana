package moves

import (
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
)

// folderMetadataJSON generates a _folder.json payload with the given stable UID and title.
func folderMetadataJSON(uid, title string) []byte {
	folder := map[string]any{
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind":       "Folder",
		"metadata": map[string]any{
			"name": uid,
		},
		"spec": map[string]any{
			"title": title,
		},
	}
	data, _ := json.MarshalIndent(folder, "", "\t")
	return data
}

// requireFolderState asserts that a folder has the expected title, sourcePath annotation,
// and parent (grafana.app/folder) annotation. It polls until the state matches or the
// timeout expires, so it is safe to call immediately after triggering a sync.
func requireFolderState(t *testing.T, helper *common.ProvisioningTestHelper, folderUID, expectedTitle, expectedSourcePath, expectedParent string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get folder %s", folderUID) {
			return
		}
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		assert.Equal(c, expectedTitle, title, "folder %s title", folderUID)
		annotations := obj.GetAnnotations()
		assert.Equal(c, expectedSourcePath, annotations["grafana.app/sourcePath"], "folder %s sourcePath", folderUID)
		assert.Equal(c, expectedParent, annotations["grafana.app/folder"], "folder %s parent", folderUID)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"folder %q should reach state: title=%q sourcePath=%q parent=%q",
		folderUID, expectedTitle, expectedSourcePath, expectedParent)
}

// findFolderUIDBySourcePath returns the UID of the folder managed by repoName at sourcePath.
// It polls until the folder appears or the timeout expires.
func findFolderUIDBySourcePath(t *testing.T, helper *common.ProvisioningTestHelper, repoName, sourcePath string) string {
	t.Helper()
	var uid string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
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

// assertNoFolderByUID asserts that the folder with the given UID no longer exists.
func assertNoFolderByUID(t *testing.T, helper *common.ProvisioningTestHelper, folderUID string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if err == nil {
			c.Errorf("folder %q still exists, expected NotFound", folderUID)
			return
		}
		assert.True(c, apierrors.IsNotFound(err),
			"expected NotFound error for folder %q, got: %v", folderUID, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"folder %q should be deleted", folderUID)
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

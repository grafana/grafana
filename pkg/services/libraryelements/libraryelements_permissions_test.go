package libraryelements_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-openapi-client-go/models"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLibraryElementPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	cfgProvider, err := configprovider.ProvideService(env.Cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), legacysql.NewDatabaseProvider(env.SQLStore), cfgProvider)
	orgService, err := orgimpl.ProvideService(env.SQLStore, env.Cfg, quotaService)
	require.NoError(t, err)

	sharedOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
	require.NoError(t, err)

	createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
		OrgID:          sharedOrg.ID,
	})
	createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
		OrgID:          sharedOrg.ID,
	})
	createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin2",
		OrgID:          sharedOrg.ID,
	})

	uid := ""
	t.Run("create", func(t *testing.T) {
		t.Run("When viewer tries to create a library panel in the General folder, it should fail", func(t *testing.T) {
			createLibraryElement(t, grafanaListedAddr, "viewer", "viewer", "", http.StatusForbidden)
		})

		t.Run("When a user tries to create a library panel in a folder that doesn't exist, it should fail", func(t *testing.T) {
			createLibraryElement(t, grafanaListedAddr, "admin2", "admin", "non-existent-folder-uid", http.StatusBadRequest)
		})

		t.Run("When editor tries to create a library panel in the General folder, it should succeed", func(t *testing.T) {
			uid = createLibraryElement(t, grafanaListedAddr, "editor", "editor", "", http.StatusOK)
			require.NotEmpty(t, uid)
			require.NotEqual(t, uid, "")
		})
	})

	t.Run("move to folder", func(t *testing.T) {
		folderUID := createTestFolder(t, grafanaListedAddr)

		t.Run("When viewer tries to move library panel to folder, it should fail", func(t *testing.T) {
			patchLibraryElement(t, grafanaListedAddr, "viewer", "viewer", uid, folderUID, http.StatusForbidden)
		})

		t.Run("When a user tries to patch a library panel by moving it to a folder that doesn't exist, it should fail", func(t *testing.T) {
			patchLibraryElement(t, grafanaListedAddr, "admin2", "admin", uid, "non-existent-folder-uid", http.StatusBadRequest)
		})

		t.Run("When editor tries to move library panel to folder, it should succeed", func(t *testing.T) {
			t.Skip() // TODO fix the flaky test
			patchLibraryElement(t, grafanaListedAddr, "editor", "editor", uid, folderUID, http.StatusOK)
		})
	})

	t.Run("move to general folder", func(t *testing.T) {
		t.Run("When viewer tries to move library panel back to general, it should fail", func(t *testing.T) {
			patchLibraryElement(t, grafanaListedAddr, "viewer", "viewer", uid, "", http.StatusForbidden)
		})

		t.Run("When editor tries to move library panel back to general, it should succeed", func(t *testing.T) {
			patchLibraryElement(t, grafanaListedAddr, "editor", "editor", uid, "", http.StatusOK)
		})
	})

	t.Run("get", func(t *testing.T) {
		t.Run("When viewer tries to get library panel, it should succeed", func(t *testing.T) {
			getLibraryElement(t, grafanaListedAddr, "viewer", "viewer", uid, http.StatusOK)
		})

		t.Run("When editor tries to get library panel, it should succeed", func(t *testing.T) {
			getLibraryElement(t, grafanaListedAddr, "editor", "editor", uid, http.StatusOK)
		})
	})

	t.Run("get all", func(t *testing.T) {
		t.Run("When viewer tries to get all library elements, it should succeed", func(t *testing.T) {
			getAllLibraryElements(t, grafanaListedAddr, "viewer", "viewer", http.StatusOK, 1)
		})

		t.Run("When editor tries to get all library elements, it should succeed", func(t *testing.T) {
			getAllLibraryElements(t, grafanaListedAddr, "editor", "editor", http.StatusOK, 1)
		})
	})

	t.Run("delete", func(t *testing.T) {
		t.Run("When viewer tries to delete library panel, it should fail", func(t *testing.T) {
			deleteLibraryElement(t, grafanaListedAddr, "viewer", "viewer", uid, http.StatusForbidden)
		})

		t.Run("When editor tries to delete library panel, it should succeed", func(t *testing.T) {
			t.Skip() // TODO fix the flaky test: https://github.com/grafana/grafana/issues/120712
			deleteLibraryElement(t, grafanaListedAddr, "editor", "editor", uid, http.StatusOK)
		})
	})
}

func TestIntegrationLibraryElementGranularPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	cfgProvider, err := configprovider.ProvideService(env.Cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), legacysql.NewDatabaseProvider(env.SQLStore), cfgProvider)
	orgService, err := orgimpl.ProvideService(env.SQLStore, env.Cfg, quotaService)
	require.NoError(t, err)

	sharedOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
	require.NoError(t, err)

	userID := createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "granular-viewer",
		Login:          "granular-viewer",
		OrgID:          sharedOrg.ID,
	})
	createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin2",
		OrgID:          sharedOrg.ID,
	})

	folder1UID := createTestFolder(t, grafanaListedAddr)
	folder2UID := createTestFolder(t, grafanaListedAddr)
	folder3UID := createTestFolder(t, grafanaListedAddr)
	folder4UID := createTestFolder(t, grafanaListedAddr)

	// viewer only has access to folder 1 & 3
	grantFolderPermission(t, grafanaListedAddr, folder1UID, userID, dashboardaccess.PERMISSION_EDIT)
	grantFolderPermission(t, grafanaListedAddr, folder3UID, userID, dashboardaccess.PERMISSION_EDIT)
	// revoke view access to folder2
	revokeFolderPermissions(t, grafanaListedAddr, folder2UID, userID)
	// read-only access to folder4: the viewer can see it but cannot create
	// library panels in it — exercises the destination-folder permission
	// check in PatchLibraryElement.
	grantFolderPermission(t, grafanaListedAddr, folder4UID, userID, dashboardaccess.PERMISSION_VIEW)

	uid := ""
	t.Run("granular createpermissions", func(t *testing.T) {
		t.Run("When viewer has write access to folder1, they can create library element in folder1", func(t *testing.T) {
			uid = createLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", folder1UID, http.StatusOK)
			require.NotEmpty(t, uid)
		})

		t.Run("When viewer doesn't have read access to folder2, they cannot create library element in folder2", func(t *testing.T) {
			// The folder is hidden from the caller by the unified storage
			// access check, so folderService.Get returns ErrFolderNotFound
			// and the legacy create handler falls back to BadRequest. This
			// matches the historical "you can't see the folder" semantics
			// (a 4xx that doesn't disclose existence).
			createLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", folder2UID, http.StatusBadRequest)
		})

		t.Run("When viewer doesn't have write access to general folder, they cannot create library element in general", func(t *testing.T) {
			createLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", "", http.StatusForbidden)
		})
	})

	t.Run("granular move permissions", func(t *testing.T) {
		t.Run("When viewer has write access to folder3 and folder1, they can move library element from folder1 to folder3", func(t *testing.T) {
			patchLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", uid, folder3UID, http.StatusOK)
		})

		t.Run("When viewer doesn't have read access to folder2, they cannot move library element to folder2", func(t *testing.T) {
			patchLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", uid, folder2UID, http.StatusForbidden)
		})

		t.Run("When viewer has read-only access to folder4, they cannot move library element to folder4", func(t *testing.T) {
			// Exercises the destination-folder permission check added to
			// PatchLibraryElement: folder4 is visible to the caller (so
			// folderService.Get succeeds), but library.panels:create is denied
			// on it. Without this check, an editor with library.panels:write
			// on the element could relocate it into any folder they can see.
			patchLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", uid, folder4UID, http.StatusForbidden)
		})
	})

	inGeneralFolder := createLibraryElement(t, grafanaListedAddr, "admin2", "admin", "", http.StatusOK)
	inFolder2 := createLibraryElement(t, grafanaListedAddr, "admin2", "admin", folder2UID, http.StatusOK)

	t.Run("granular read permissions", func(t *testing.T) {
		t.Run("When viewer has read access to folder1, they can get library element from folder1", func(t *testing.T) {
			getLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", uid, http.StatusOK)
		})

		t.Run("When viewer doesn't have read access to folder2, they cannot get library element from folder2", func(t *testing.T) {
			// The unified storage access check hides folder2 from the caller
			// entirely; folderService.Get returns ErrFolderNotFound, which
			// the legacy get handler maps to 404 (NotFound) — k8s-style
			// "you don't see this resource" rather than 403.
			getLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", inFolder2, http.StatusNotFound)
		})

		t.Run("When viewer has limited folder access, they only see library elements from accessible folders", func(t *testing.T) {
			getAllLibraryElements(t, grafanaListedAddr, "granular-viewer", "granular-viewer", http.StatusOK, 2)
		})
	})

	t.Run("granular delete permissions", func(t *testing.T) {
		t.Run("When viewer has write access to folder1, they can delete library element from folder1", func(t *testing.T) {
			deleteLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", uid, http.StatusOK)
		})

		t.Run("When viewer doesn't have write access to folder2, they cannot delete library element from folder2", func(t *testing.T) {
			deleteLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", inFolder2, http.StatusForbidden)
		})

		t.Run("When viewer doesn't have write access to general folder, they cannot delete library element from general", func(t *testing.T) {
			deleteLibraryElement(t, grafanaListedAddr, "granular-viewer", "granular-viewer", inGeneralFolder, http.StatusForbidden)
		})
	})
}

// TestIntegrationLibraryElementNameRouteRequiresReadPermission guards the route-level RBAC added
// to GET /api/library-elements/name/:name. The unscoped library.panels:read check rejects a user
// who lacks the action entirely (403) while leaving a permitted user unaffected (200). Folder-
// scoped denial is a different code path (handled by the per-element filter) covered elsewhere.
func TestIntegrationLibraryElementNameRouteRequiresReadPermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	cfgProvider, err := configprovider.ProvideService(env.Cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), legacysql.NewDatabaseProvider(env.SQLStore), cfgProvider)
	orgService, err := orgimpl.ProvideService(env.SQLStore, env.Cfg, quotaService)
	require.NoError(t, err)

	sharedOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "test org"})
	require.NoError(t, err)

	createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin2",
		Login:          "admin2",
		OrgID:          sharedOrg.ID,
	})
	// A user with no basic role has none of the fixed roles, so it lacks
	// library.panels:read entirely — which is what trips the route middleware.
	createUserInOrg(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleNone),
		Password:       "noperms",
		Login:          "noperms",
		OrgID:          sharedOrg.ID,
	})

	createLibraryElement(t, grafanaListedAddr, "admin2", "admin2", "", http.StatusOK)
	const panelName = "Library Panel Name" // the name createLibraryElement assigns

	t.Run("user with library.panels:read can read by name", func(t *testing.T) {
		getLibraryElementByName(t, grafanaListedAddr, "admin2", "admin2", panelName, http.StatusOK)
	})

	t.Run("user without library.panels:read is forbidden", func(t *testing.T) {
		getLibraryElementByName(t, grafanaListedAddr, "noperms", "noperms", panelName, http.StatusForbidden)
	})
}

/*
	Helper functions
*/

func createLibraryElement(t *testing.T, grafanaListedAddr, user, password, folderUID string, expectedStatus int) string {
	m := map[string]interface{}{
		"datasource":  "${DS_GDEV-TESTDATA}",
		"id":          1,
		"title":       "Text - Library Panel",
		"type":        "text",
		"description": "A description",
	}
	createRequest := map[string]interface{}{
		"name":      "Library Panel Name",
		"model":     m,
		"folderUid": folderUID,
		"kind":      int64(1),
	}

	resp := makeHTTPRequest(t, "POST", fmt.Sprintf("http://%s:%s@%s/api/library-elements", user, password, grafanaListedAddr), createRequest, expectedStatus)
	if expectedStatus == http.StatusOK {
		var result model.LibraryElementResponse
		err := json.Unmarshal(resp, &result)
		require.NoError(t, err)
		return result.Result.UID
	}

	return ""
}

func patchLibraryElement(t *testing.T, grafanaListedAddr, user, password, uid, folderUID string, expectedStatus int) {
	version := getLibraryElementVersion(t, grafanaListedAddr, user, password, uid)
	patchRequest := map[string]interface{}{
		"folderUid": folderUID,
		"version":   version,
		"kind":      1,
	}
	makeHTTPRequest(t, "PATCH", fmt.Sprintf("http://%s:%s@%s/api/library-elements/%s", user, password, grafanaListedAddr, uid), patchRequest, expectedStatus)
}

func deleteLibraryElement(t *testing.T, grafanaListedAddr, user, password, uid string, expectedStatus int) {
	makeHTTPRequest(t, "DELETE", fmt.Sprintf("http://%s:%s@%s/api/library-elements/%s", user, password, grafanaListedAddr, uid), nil, expectedStatus)
}

func getLibraryElement(t *testing.T, grafanaListedAddr, user, password, uid string, expectedStatus int) {
	makeHTTPRequest(t, "GET", fmt.Sprintf("http://%s:%s@%s/api/library-elements/%s", user, password, grafanaListedAddr, uid), nil, expectedStatus)
}

func getLibraryElementByName(t *testing.T, grafanaListedAddr, user, password, name string, expectedStatus int) {
	makeHTTPRequest(t, "GET", fmt.Sprintf("http://%s:%s@%s/api/library-elements/name/%s", user, password, grafanaListedAddr, url.PathEscape(name)), nil, expectedStatus)
}

func getAllLibraryElements(t *testing.T, grafanaListedAddr, user, password string, expectedStatus int, expectedLength int) {
	resp := makeHTTPRequest(t, "GET", fmt.Sprintf("http://%s:%s@%s/api/library-elements", user, password, grafanaListedAddr), nil, expectedStatus)
	if expectedStatus == http.StatusOK {
		var result model.LibraryElementSearchResponse
		err := json.Unmarshal(resp, &result)
		require.NoError(t, err)
		require.Len(t, result.Result.Elements, expectedLength)
	}
}

func getLibraryElementVersion(t *testing.T, grafanaListedAddr, user, password, uid string) int {
	resp := makeHTTPRequest(t, "GET", fmt.Sprintf("http://%s:%s@%s/api/library-elements/%s", user, password, grafanaListedAddr, uid), nil, http.StatusOK)
	var getResult model.LibraryElementResponse
	err := json.Unmarshal(resp, &getResult)
	require.NoError(t, err)

	return int(getResult.Result.Version)
}

func createTestFolder(t *testing.T, grafanaListedAddr string) string {
	folderRequest := map[string]interface{}{
		"title": "Test Folder",
	}
	resp := makeHTTPRequest(t, "POST", fmt.Sprintf("http://admin2:admin@%s/api/folders", grafanaListedAddr), folderRequest, http.StatusOK)
	var folder models.Folder
	err := json.Unmarshal(resp, &folder)
	require.NoError(t, err)
	return folder.UID
}

func grantFolderPermission(t *testing.T, grafanaListedAddr, folderUID string, userID int64, permission dashboardaccess.PermissionType) {
	permissionRequest := map[string]interface{}{
		"items": []map[string]interface{}{
			{
				"userId":     userID,
				"permission": int(permission),
			},
		},
	}
	makeHTTPRequest(t, "POST", fmt.Sprintf("http://admin2:admin@%s/api/folders/%s/permissions", grafanaListedAddr, folderUID), permissionRequest, http.StatusOK)
}

func revokeFolderPermissions(t *testing.T, grafanaListedAddr, folderUID string, userID int64) {
	permissionRequest := map[string]interface{}{
		"items": []map[string]interface{}{},
	}
	makeHTTPRequest(t, "POST", fmt.Sprintf("http://admin2:admin@%s/api/folders/%s/permissions", grafanaListedAddr, folderUID), permissionRequest, http.StatusOK)
}

func makeHTTPRequest(t *testing.T, method, url string, body interface{}, expectedStatus int) []byte {
	var req *http.Request
	var err error

	if body != nil {
		buf := &bytes.Buffer{}
		err = json.NewEncoder(buf).Encode(body)
		require.NoError(t, err)
		req, err = http.NewRequest(method, url, buf)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, err = http.NewRequest(method, url, nil)
		require.NoError(t, err)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	// nolint:errcheck
	defer resp.Body.Close()
	require.Equal(t, expectedStatus, resp.StatusCode)

	respBody, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return respBody
}

func createUserInOrg(t *testing.T, db db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) int64 {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1

	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), legacysql.NewDatabaseProvider(db), cfgProvider)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		db, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(), nil,
	)
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}

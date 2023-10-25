package folders

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const orgID = 1

func TestIntegrationCreateFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableQuota:      true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// Create user
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	t.Run("create folder under root should succeed", func(t *testing.T) {
		buf := &bytes.Buffer{}
		err := json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
			Title: "folder",
			OrgID: orgID,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		t.Run("create folder with same name under root should fail", func(t *testing.T) {
			err := json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
				Title: "folder",
				OrgID: orgID,
			})
			require.NoError(t, err)
			u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
			// nolint:gosec
			resp, err = http.Post(u, "application/json", buf)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			require.NoError(t, err)
			require.Equal(t, http.StatusConflict, resp.StatusCode)
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.JSONEq(t, fmt.Sprintf(`{"message":"%s"}`, dashboards.ErrFolderSameNameExists), string(b))
		})
	})
}

func TestIntegrationNestedFoldersOn(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableQuota:          true,
		EnableFeatureToggles: []string{featuremgmt.FlagNestedFolders},
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// Create user
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	t.Run("create folder under root should succeed", func(t *testing.T) {
		buf := &bytes.Buffer{}
		err := json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
			Title: "folder",
			OrgID: orgID,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		t.Run("create folder with same name under root should fail", func(t *testing.T) {
			err := json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
				Title: "folder",
				OrgID: orgID,
			})
			require.NoError(t, err)
			u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
			// nolint:gosec
			resp, err = http.Post(u, "application/json", buf)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusConflict, resp.StatusCode)
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.JSONEq(t, fmt.Sprintf(`{"message":"%s"}`, dashboards.ErrFolderSameNameExists), string(b))
		})
	})

	t.Run("create subfolder should succeed", func(t *testing.T) {
		buf := &bytes.Buffer{}
		err := json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
			Title: "parent",
			OrgID: orgID,
		})
		require.NoError(t, err)
		parentUID := createFolder(t, grafanaListedAddr, buf)

		buf.Reset()
		err = json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
			Title:     "subfolder",
			OrgID:     orgID,
			ParentUID: parentUID,
		})
		subfolderUnderParent := createFolder(t, grafanaListedAddr, buf)

		t.Run("create subfolder with same name should fail", func(t *testing.T) {
			buf.Reset()
			err = json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
				Title:     "subfolder",
				OrgID:     orgID,
				ParentUID: parentUID,
			})
			u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
			// nolint:gosec
			resp, err := http.Post(u, "application/json", buf)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusConflict, resp.StatusCode)
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.JSONEq(t, fmt.Sprintf(`{"message":"%s"}`, dashboards.ErrFolderSameNameExists), string(b))
		})

		t.Run("create subfolder with same name under other folder should succeed", func(t *testing.T) {
			buf.Reset()
			err := json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
				Title: "other",
				OrgID: orgID,
			})
			require.NoError(t, err)
			other := createFolder(t, grafanaListedAddr, buf)

			buf.Reset()
			err = json.NewEncoder(buf).Encode(folder.CreateFolderCommand{
				Title:     "subfolder",
				OrgID:     orgID,
				ParentUID: other,
			})
			require.NoError(t, err)
			u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
			// nolint:gosec
			resp, err := http.Post(u, "application/json", buf)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			require.NoError(t, err)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			var folderResp dtos.Folder
			err = json.Unmarshal(b, &folderResp)
			require.NoError(t, err)
			assert.Equal(t, other, folderResp.ParentUID)
			subfolderUnderOther := folderResp.Uid

			t.Run("move subfolder to other folder containing folder with that name should fail", func(t *testing.T) {
				buf.Reset()
				err = json.NewEncoder(buf).Encode(folder.MoveFolderCommand{
					OrgID:        orgID,
					NewParentUID: parentUID,
				})
				u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/move", grafanaListedAddr, subfolderUnderOther)
				// nolint:gosec
				resp, err := http.Post(u, "application/json", buf)
				t.Cleanup(func() {
					err := resp.Body.Close()
					require.NoError(t, err)
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusConflict, resp.StatusCode)
			})
		})

		t.Run("move subfolder to root should succeed", func(t *testing.T) {
			buf.Reset()
			err = json.NewEncoder(buf).Encode(folder.MoveFolderCommand{
				OrgID: orgID,
			})
			u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/move", grafanaListedAddr, subfolderUnderParent)
			// nolint:gosec
			resp, err := http.Post(u, "application/json", buf)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			var folderResp dtos.Folder
			err = json.Unmarshal(b, &folderResp)
			require.NoError(t, err)
			assert.Equal(t, "", folderResp.ParentUID)
		})
	})
}

func createUser(t *testing.T, store *sqlstore.SQLStore, cmd user.CreateUserCommand) int64 {
	t.Helper()

	store.Cfg.AutoAssignOrg = true
	store.Cfg.AutoAssignOrgId = 1

	quotaService := quotaimpl.ProvideService(store, store.Cfg)
	orgService, err := orgimpl.ProvideService(store, store.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(store, orgService, store.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}

func createFolder(t *testing.T, grafanaListedAddr string, buf *bytes.Buffer) string {
	u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", buf)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})
	require.NoError(t, err)
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var folderResp dtos.Folder
	err = json.Unmarshal(b, &folderResp)
	require.NoError(t, err)
	return folderResp.Uid
}

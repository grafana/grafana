package folders

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-openapi-client-go/models"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const orgID = 1

func TestIntegrationUpdateFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableQuota:      true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	store, cfg := env.SQLStore, env.Cfg
	// Create user
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")
	resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
		Title: "folder",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.Code())

	t.Run("update folder should succeed", func(t *testing.T) {
		resp, err := adminClient.Folders.UpdateFolder(resp.Payload.UID, &models.UpdateFolderCommand{
			Title:   "new title",
			Version: resp.Payload.Version,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())
		require.Equal(t, "new title", resp.Payload.Title)
	})
}

func TestIntegrationCreateFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableQuota:      true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	store, cfg := env.SQLStore, env.Cfg
	// Create user
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")

	t.Run("create folder under root should succeed", func(t *testing.T) {
		resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "folder",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())

		t.Run("create folder with same name under root should succeed", func(t *testing.T) {
			_, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
				Title: "folder",
			})
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.Code())
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

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	store, cfg := env.SQLStore, env.Cfg
	// Create user
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")

	t.Run("create folder under root should succeed", func(t *testing.T) {
		resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "folder",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())

		t.Run("create folder with same name under root should succeed", func(t *testing.T) {
			_, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
				Title: "folder",
			})
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.Code())
		})
	})

	t.Run("create subfolder should succeed", func(t *testing.T) {
		resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "parent",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())
		parentUID := resp.Payload.UID

		resp, err = adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title:     "subfolder",
			ParentUID: parentUID,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())

		t.Run("create subfolder with same name should succeed", func(t *testing.T) {
			resp, err = adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
				Title:     "subfolder",
				ParentUID: parentUID,
			})
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.Code())
		})

		t.Run("create subfolder with same name under other folder should succeed", func(t *testing.T) {
			resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
				Title: "other",
			})
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.Code())
			other := resp.Payload.UID

			resp, err = adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
				Title:     "subfolder",
				ParentUID: other,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.Code())
			assert.Equal(t, other, resp.Payload.ParentUID)
			subfolderUnderOther := resp.Payload.UID

			t.Run("move subfolder to other folder containing folder with the same name should be ok", func(t *testing.T) {
				resp, err := adminClient.Folders.MoveFolder(subfolderUnderOther, &models.MoveFolderCommand{
					ParentUID: parentUID,
				})
				require.NoError(t, err)
				assert.Equal(t, http.StatusOK, resp.Code())
				assert.Equal(t, parentUID, resp.Payload.ParentUID)
			})

			t.Run("move subfolder to root should succeed", func(t *testing.T) {
				resp, err := adminClient.Folders.MoveFolder(subfolderUnderOther, &models.MoveFolderCommand{})
				require.NoError(t, err)
				assert.Equal(t, http.StatusOK, resp.Code())
				assert.Equal(t, "", resp.Payload.ParentUID)
			})
		})
	})
}

func createUser(t *testing.T, db db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) int64 {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = orgID

	quotaService := quotaimpl.ProvideService(db, cfg)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		db, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}

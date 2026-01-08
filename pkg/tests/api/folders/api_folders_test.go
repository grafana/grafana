package folders

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-openapi-client-go/client/folders"
	"github.com/grafana/grafana-openapi-client-go/models"

	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/retryer"
	"github.com/grafana/grafana/pkg/util/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationGetFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Setup Grafana and its Database
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	store, cfg := env.SQLStore, env.Cfg

	orgID := int64(1)

	// Create a users to make authenticated requests
	tests.CreateUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		OrgID:          orgID,
		Password:       "viewer",
		Login:          "viewer",
	})
	tests.CreateUser(t, store, cfg, user.CreateUserCommand{
		OrgID:          orgID,
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
	tests.CreateUser(t, store, cfg, user.CreateUserCommand{
		OrgID:          orgID,
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin2",
	})

	adminClient := tests.GetClient(grafanaListedAddr, "admin2", "admin")
	editorClient := tests.GetClient(grafanaListedAddr, "editor", "editor")
	viewerClient := tests.GetClient(grafanaListedAddr, "viewer", "viewer")

	// access control permissions store
	permissionsStore := resourcepermissions.NewStore(cfg, store, featuremgmt.WithFeatures())

	numberOfFolders := 5
	indexWithoutPermission := 3

	for i := 0; i < numberOfFolders; i++ {
		respCode := 0
		folderUID := ""
		retries := 0
		maxRetries := 3
		err := retryer.Retry(func() (retryer.RetrySignal, error) {
			resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
				Title: fmt.Sprintf("Folder %d", i),
				UID:   fmt.Sprintf("folder-%d", i),
			})
			if err != nil {
				if retries == maxRetries {
					return retryer.FuncError, err
				}
				retries++
				return retryer.FuncFailure, nil
			}
			respCode = resp.Code()
			folderUID = resp.Payload.UID
			return retryer.FuncComplete, nil
		}, maxRetries, time.Millisecond*time.Duration(10), time.Second)
		require.NoError(t, err)

		require.Equal(t, http.StatusOK, respCode)
		if i == indexWithoutPermission {
			tests.RemoveFolderPermission(t, permissionsStore, orgID, org.RoleViewer, folderUID)
			t.Log("Removed viewer permission from folder", folderUID)
		}
	}

	t.Run("Admin can get all folders", func(t *testing.T) {
		res, err := adminClient.Folders.GetFolders(folders.NewGetFoldersParams())
		require.NoError(t, err)
		actualFolders := make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-0", "folder-1", "folder-2", "folder-3", "folder-4"}, actualFolders)
	})

	t.Run("Pagination works as expect for admin", func(t *testing.T) {
		limit := int64(2)
		page := int64(1)
		res, err := adminClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders := make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-0", "folder-1"}, actualFolders)

		page = int64(2)
		res, err = adminClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders = make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-2", "folder-3"}, actualFolders)

		page = int64(3)
		res, err = adminClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders = make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-4"}, actualFolders)
	})

	t.Run("Editor can get all folders", func(t *testing.T) {
		res, err := editorClient.Folders.GetFolders(folders.NewGetFoldersParams())
		require.NoError(t, err)
		actualFolders := make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{folder.SharedWithMeFolderUID, "folder-0", "folder-1", "folder-2", "folder-3", "folder-4"}, actualFolders)
	})

	t.Run("Pagination works as expect for editor", func(t *testing.T) {
		limit := int64(2)
		page := int64(1)
		res, err := editorClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders := make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{folder.SharedWithMeFolderUID, "folder-0", "folder-1"}, actualFolders)

		page = int64(2)
		res, err = editorClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders = make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-2", "folder-3"}, actualFolders)

		page = int64(3)
		res, err = editorClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders = make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-4"}, actualFolders)
	})

	t.Run("Viewer can get only the folders has access too", func(t *testing.T) {
		res, err := viewerClient.Folders.GetFolders(folders.NewGetFoldersParams())
		require.NoError(t, err)
		actualFolders := make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{folder.SharedWithMeFolderUID, "folder-0", "folder-1", "folder-2", "folder-4"}, actualFolders)
	})

	t.Run("Pagination works as expect for viewer", func(t *testing.T) {
		limit := int64(2)
		page := int64(1)
		res, err := viewerClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders := make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{folder.SharedWithMeFolderUID, "folder-0", "folder-1"}, actualFolders)

		page = int64(2)
		res, err = viewerClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		actualFolders = make([]string, 0, len(res.Payload))
		for i := range res.Payload {
			actualFolders = append(actualFolders, res.Payload[i].UID)
		}
		assert.Equal(t, []string{"folder-2", "folder-4"}, actualFolders)

		page = int64(3)
		res, err = viewerClient.Folders.GetFolders(folders.NewGetFoldersParams().WithLimit(&limit).WithPage(&page))
		require.NoError(t, err)
		assert.Len(t, res.Payload, 0)
	})
}

package folders

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-openapi-client-go/client/folders"
	"github.com/grafana/grafana-openapi-client-go/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setFolderPermissions(t *testing.T, grafanaListedAddr string, folderUID string, permissions []map[string]interface{}) {
	t.Helper()

	permissionPayload := map[string]interface{}{
		"items": permissions,
	}

	payloadBytes, err := json.Marshal(permissionPayload)
	require.NoError(t, err)

	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", grafanaListedAddr, folderUID)
	resp, err := http.Post(u, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func TestIntegrationFolderServiceGetFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles:  []string{featuremgmt.FlagNestedFolders, featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, p)
	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")

	parentResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
		Title: "Parent Folder",
		UID:   "parent-folder",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, parentResp.Code())

	childResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
		Title:     "Child Folder",
		UID:       "child-folder",
		ParentUID: parentResp.Payload.UID,
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, childResp.Code())

	testCases := []struct {
		name                 string
		WithFullpath         bool
		WithFullpathUIDs     bool
		expectedFullpath     string
		expectedFullpathUIDs string
	}{
		{
			name:             "when flag is on and WithFullpath is false",
			WithFullpath:     false,
			expectedFullpath: "",
		},
		{
			name:             "when flag is on and WithFullpath is true",
			WithFullpath:     true,
			expectedFullpath: "Parent Folder/Child Folder",
		},
		{
			name:                 "when flag is on and WithFullpathUIDs is false",
			WithFullpathUIDs:     false,
			expectedFullpathUIDs: "",
		},
		{
			name:                 "when flag is on and WithFullpathUIDs is true",
			WithFullpathUIDs:     true,
			expectedFullpathUIDs: "parent-folder/child-folder",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := adminClient.Folders.GetFolderByUID(childResp.Payload.UID)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.Code())
			require.Equal(t, childResp.Payload.UID, resp.Payload.UID)
			require.Equal(t, childResp.Payload.CreatedBy, resp.Payload.CreatedBy)
			require.Equal(t, childResp.Payload.UpdatedBy, resp.Payload.UpdatedBy)
		})
	}
}

func TestIntegrationUpdateFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableQuota:          true,
		EnableFeatureToggles: []string{featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

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

	t.Run("When updating a folder it should trim leading and trailing spaces", func(t *testing.T) {
		resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "my folder 2",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())

		updateResp, err := adminClient.Folders.UpdateFolder(resp.Payload.UID, &models.UpdateFolderCommand{
			Title:   "  my updated folder 2 ",
			Version: resp.Payload.Version,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, updateResp.Code())
		require.Equal(t, "my updated folder 2", updateResp.Payload.Title)
	})
}

func TestIntegrationCreateFolder(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableQuota:          true,
		EnableFeatureToggles: []string{featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

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

	t.Run("When creating a folder it should trim leading and trailing spaces", func(t *testing.T) {
		resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "  my folder  ",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())
		require.Equal(t, "my folder", resp.Payload.Title)
	})

	t.Run("create without UID, no error", func(t *testing.T) {
		resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "myFolder",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())
		require.NotEmpty(t, resp.Payload.UID)
	})
}

func TestIntegrationNestedFoldersOn(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableQuota:          true,
		EnableFeatureToggles: []string{featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

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

			t.Run("should prevent moving folders to escalate permissions", func(t *testing.T) {
				store, cfg := env.SQLStore, env.Cfg
				orgID := int64(1)
				editorUser := tests.CreateUser(t, store, cfg, user.CreateUserCommand{
					DefaultOrgRole: string(org.RoleViewer),
					OrgID:          orgID,
					Password:       "editor",
					Login:          "editor",
				})
				editorClient := tests.GetClient(grafanaListedAddr, "editor", "editor")

				sourceResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Source Folder",
					UID:   "source-folder-limited",
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, sourceResp.Code())

				destResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Destination Folder",
					UID:   "dest-folder-higher",
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, destResp.Code())
				// downgrade to viewer on destination folder
				setFolderPermissions(t, grafanaListedAddr, destResp.Payload.UID, []map[string]interface{}{
					{
						"userId":     editorUser,
						"permission": 1,
					},
				})

				_, err = editorClient.Folders.MoveFolder(sourceResp.Payload.UID, &models.MoveFolderCommand{
					ParentUID: destResp.Payload.UID,
				})
				require.Error(t, err)
			})
		})
	})

	t.Run("should delete children of a folder when deleted", func(t *testing.T) {
		parentResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "Parent Folder for Delete",
			UID:   "parent-folder-delete",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, parentResp.Code())

		childResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title:     "Child Folder for Delete",
			UID:       "child-folder-delete",
			ParentUID: parentResp.Payload.UID,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, childResp.Code())

		_, err = adminClient.Folders.DeleteFolder(folders.NewDeleteFolderParams().WithFolderUID(parentResp.Payload.UID))
		require.NoError(t, err)

		_, err = adminClient.Folders.GetFolderByUID(childResp.Payload.UID)
		require.Error(t, err)
	})
}

func TestIntegrationSharedWithMe(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles:  []string{featuremgmt.FlagNestedFolders, featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	store, cfg := env.SQLStore, env.Cfg
	orgID := int64(1)
	noneUser := tests.CreateUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleNone),
		OrgID:          orgID,
		Password:       "none",
		Login:          "none",
	})
	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")
	noneClient := tests.GetClient(grafanaListedAddr, "none", "none")

	t.Run("Should get folders shared with given user", func(t *testing.T) {
		folder1Resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title: "Folder 1",
			UID:   "folder-1",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, folder1Resp.Code())

		folder2Resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
			Title:     "Folder 2",
			UID:       "folder-2",
			ParentUID: folder1Resp.Payload.UID,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, folder2Resp.Code())
		setFolderPermissions(t, grafanaListedAddr, folder2Resp.Payload.UID, []map[string]interface{}{
			{
				"userId":     noneUser,
				"permission": 1,
			},
		})

		resp, err := noneClient.Folders.GetFolders(nil)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.Code())
		require.Len(t, resp.Payload, 1)
	})
}

func TestIntegrationBasicRoles(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles:  []string{featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	store, cfg := env.SQLStore, env.Cfg

	orgID := int64(1)

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

	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")
	viewerClient := tests.GetClient(grafanaListedAddr, "viewer", "viewer")

	t.Run("Folder service tests", func(t *testing.T) {
		t.Run("Given user has no permissions", func(t *testing.T) {
			folderUID := "test-folder-no-perm"

			t.Run("get folder by uid should return access denied error", func(t *testing.T) {
				_, err := viewerClient.Folders.GetFolderByUID(folderUID)
				require.Error(t, err)
			})

			t.Run("create folder should return access denied error", func(t *testing.T) {
				_, err := viewerClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Test Folder",
					UID:   "test-create-no-perm",
				})
				require.Error(t, err)
			})

			t.Run("update folder should return access denied error", func(t *testing.T) {
				_, err := viewerClient.Folders.UpdateFolder(folderUID, &models.UpdateFolderCommand{
					Title: "Updated Title",
				})
				require.Error(t, err)
			})

			t.Run("delete folder by uid should return access denied error", func(t *testing.T) {
				_, err := viewerClient.Folders.DeleteFolder(folders.NewDeleteFolderParams().WithFolderUID(folderUID))
				require.Error(t, err)
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			t.Run("create folder should be ok", func(t *testing.T) {
				resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Test-Folder",
					UID:   "test-folder-create",
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, resp.Code())
				require.Equal(t, "Test-Folder", resp.Payload.Title)
			})

			t.Run("can never create a folder with the uid of general", func(t *testing.T) {
				_, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Test-Folder",
					UID:   "general",
				})
				require.Error(t, err)
			})

			t.Run("update should be okay", func(t *testing.T) {
				resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Folder to Update",
					UID:   "test-folder-update",
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, resp.Code())

				updateResp, err := adminClient.Folders.UpdateFolder(resp.Payload.UID, &models.UpdateFolderCommand{
					Title:   "Updated Folder Title",
					Version: resp.Payload.Version,
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, updateResp.Code())
				require.Equal(t, "Updated Folder Title", updateResp.Payload.Title)
			})

			t.Run("delete should be okay", func(t *testing.T) {
				resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Folder to Delete",
					UID:   "test-folder-delete",
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, resp.Code())

				_, err = adminClient.Folders.DeleteFolder(folders.NewDeleteFolderParams().WithFolderUID(resp.Payload.UID))
				require.NoError(t, err)
			})
		})

		t.Run("Given user has permission to view", func(t *testing.T) {
			t.Run("get folder by uid should return folder", func(t *testing.T) {
				resp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
					Title: "Viewable Folder",
					UID:   "test-folder-view",
				})
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, resp.Code())

				getResp, err := viewerClient.Folders.GetFolderByUID(resp.Payload.UID)
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, getResp.Code())
				require.Equal(t, "Viewable Folder", getResp.Payload.Title)
			})

			t.Run("get folder by uid and uid is general should return the root folder object", func(t *testing.T) {
				resp, err := adminClient.Folders.GetFolderByUID("general")
				require.NoError(t, err)
				require.Equal(t, http.StatusOK, resp.Code())
				require.Equal(t, "Dashboards", resp.Payload.Title)
			})
		})
	})
}

func TestIntegrationFineGrainedPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles:  []string{featuremgmt.FlagNestedFolders, featuremgmt.FlagKubernetesClientDashboardsFolders},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	store, cfg := env.SQLStore, env.Cfg

	orgID := int64(1)
	noneUser := tests.CreateUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleNone),
		OrgID:          orgID,
		Password:       "none",
		Login:          "none",
	})

	adminClient := tests.GetClient(grafanaListedAddr, "admin", "admin")
	noneClient := tests.GetClient(grafanaListedAddr, "none", "none")

	// create parent -> child -> grandchild folder structure
	parentResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
		Title: "Parent Folder",
		UID:   "parent-folder-fine-grained",
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, parentResp.Code())

	childResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
		Title:     "Child Folder",
		UID:       "child-folder-fine-grained",
		ParentUID: parentResp.Payload.UID,
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, childResp.Code())

	grandchildResp, err := adminClient.Folders.CreateFolder(&models.CreateFolderCommand{
		Title:     "Grandchild Folder",
		UID:       "grandchild-folder-fine-grained",
		ParentUID: childResp.Payload.UID,
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, grandchildResp.Code())

	// only grant access to the child folder, should then get child & grandchildren folders
	setFolderPermissions(t, grafanaListedAddr, childResp.Payload.UID, []map[string]interface{}{
		{
			"userId":     noneUser,
			"permission": 1,
		},
	})

	childFolderResp, err := noneClient.Folders.GetFolderByUID(childResp.Payload.UID)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, childFolderResp.Code())
	assert.Equal(t, "Child Folder", childFolderResp.Payload.Title)

	grandchildFolderResp, err := noneClient.Folders.GetFolderByUID(grandchildResp.Payload.UID)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, grandchildFolderResp.Code())
	assert.Equal(t, "Grandchild Folder", grandchildFolderResp.Payload.Title)

	_, err = noneClient.Folders.GetFolderByUID(parentResp.Payload.UID)
	require.Error(t, err, "None user should not be able to access parent folder directly")
}

package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Repository-managed (provisioned) folders reject library element writes from
// regular users so manual edits cannot drift from the synced source of truth.
// The provisioning service identity must be exempt so Git Sync can create and
// update the panels it manages inside those folders.
func TestIntegration_LibraryElement_ProvisionedFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const provisionedFolderUID = "uid_for_ProvisionedFolder"

	provisionedFolder := func() *folder.Folder {
		return &folder.Folder{
			ID:        2, // nolint:staticcheck
			OrgID:     1,
			UID:       provisionedFolderUID,
			Title:     "ProvisionedFolder",
			ManagedBy: utils.ManagerKindRepo,
		}
	}

	rawModel := func(t *testing.T) json.RawMessage {
		t.Helper()
		b, err := json.Marshal(map[string]any{"type": "text", "title": "Provisioned Library Panel"})
		require.NoError(t, err)
		return b
	}

	t.Run("CreateElement", func(t *testing.T) {
		t.Run("a regular user cannot create a library panel in a provisioned folder", func(t *testing.T) {
			sc := setupTestScenario(t)
			sc.folderSvc.ExpectedFolder = provisionedFolder()
			folderUID := provisionedFolderUID

			_, err := sc.service.CreateElement(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, model.CreateLibraryElementCommand{
				FolderUID: &folderUID,
				Name:      "Regular User Panel",
				Kind:      int64(model.PanelElement),
				Model:     rawModel(t),
			})
			require.ErrorIs(t, err, model.ErrLibraryElementProvisionedFolder)
		})

		t.Run("the provisioning identity can create a library panel in a provisioned folder", func(t *testing.T) {
			sc := setupTestScenario(t)
			sc.folderSvc.ExpectedFolder = provisionedFolder()
			folderUID := provisionedFolderUID

			ctx, provisioner, err := identity.WithProvisioningIdentity(sc.reqContext.Req.Context(), "default")
			require.NoError(t, err)

			result, err := sc.service.CreateElement(ctx, provisioner, model.CreateLibraryElementCommand{
				FolderUID: &folderUID,
				Name:      "Provisioned Panel",
				Kind:      int64(model.PanelElement),
				Model:     rawModel(t),
			})
			require.NoError(t, err)
			require.NotEmpty(t, result.UID)
		})
	})

	t.Run("PatchLibraryElement", func(t *testing.T) {
		t.Run("a regular user cannot move a library panel into a provisioned folder", func(t *testing.T) {
			sc := setupTestScenario(t)
			created := createPanelInScenarioFolder(t, sc)

			sc.folderSvc.ExpectedFolder = provisionedFolder()
			folderUID := provisionedFolderUID

			_, err := sc.service.PatchLibraryElement(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, model.PatchLibraryElementCommand{
				FolderUID: &folderUID,
				Kind:      int64(model.PanelElement),
				Version:   created.Version,
			}, created.UID)
			require.ErrorIs(t, err, model.ErrLibraryElementProvisionedFolder)
		})

		t.Run("the provisioning identity can move a library panel into a provisioned folder", func(t *testing.T) {
			sc := setupTestScenario(t)
			created := createPanelInScenarioFolder(t, sc)

			sc.folderSvc.ExpectedFolder = provisionedFolder()
			folderUID := provisionedFolderUID

			ctx, provisioner, err := identity.WithProvisioningIdentity(sc.reqContext.Req.Context(), "default")
			require.NoError(t, err)

			result, err := sc.service.PatchLibraryElement(ctx, provisioner, model.PatchLibraryElementCommand{
				FolderUID: &folderUID,
				Kind:      int64(model.PanelElement),
				Version:   created.Version,
			}, created.UID)
			require.NoError(t, err)
			require.Equal(t, created.UID, result.UID)
		})
	})
}

// createPanelInScenarioFolder creates a library panel in the scenario's regular
// (non-provisioned) folder so subsequent patch operations have an element to
// move.
func createPanelInScenarioFolder(t *testing.T, sc scenarioContext) model.LibraryElementDTO {
	t.Helper()
	b, err := json.Marshal(map[string]any{"type": "text", "title": "Existing Library Panel"})
	require.NoError(t, err)
	created, err := sc.service.CreateElement(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, model.CreateLibraryElementCommand{
		FolderUID: &sc.folder.UID,
		Name:      "Existing Library Panel",
		Kind:      int64(model.PanelElement),
		Model:     b,
	})
	require.NoError(t, err)
	return created
}

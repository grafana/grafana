package libraryelements

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

type storedFolder struct {
	FolderID  int64  `xorm:"folder_id"`
	FolderUID string `xorm:"folder_uid"`
}

func readStoredFolder(t *testing.T, sc scenarioContext, uid string) storedFolder {
	t.Helper()
	var row storedFolder
	err := sc.sqlStore.WithDbSession(sc.reqContext.Req.Context(), func(session *db.Session) error {
		found, err := session.SQL("SELECT folder_id, folder_uid FROM library_element WHERE uid = ?", uid).Get(&row)
		require.NoError(t, err)
		require.True(t, found, "library_element row not found for uid %s", uid)
		return nil
	})
	require.NoError(t, err)
	return row
}

func createK8sPanel(t *testing.T, sc scenarioContext, uid, folderUID string) {
	t.Helper()
	fuid := folderUID
	_, err := sc.service.CreateElement(sc.reqContext.Req.Context(), &sc.user, model.CreateLibraryElementCommand{
		UID:       uid,
		FolderUID: &fuid,
		Kind:      int64(model.PanelElement),
		Name:      "k8s panel",
		Model:     []byte(`{"type":"timeseries","title":"k8s panel"}`),
		// FolderID intentionally left 0, as the k8s conversion does.
	})
	require.NoError(t, err)
}

func TestIntegration_K8sWritePath_FolderConsistency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("create resolves the legacy folder_id from folder_uid", func(t *testing.T) {
		sc := setupTestScenario(t)
		const folderUID = "uid_for_target"
		sc.folderSvc.ExpectedFolder = &folder.Folder{ID: 42, OrgID: sc.user.OrgID, UID: folderUID, Title: "target"}

		fuid := folderUID
		dto, err := sc.service.CreateElement(sc.reqContext.Req.Context(), &sc.user, model.CreateLibraryElementCommand{
			UID:       "k8s-create",
			FolderUID: &fuid,
			Kind:      int64(model.PanelElement),
			Name:      "k8s panel",
			Model:     []byte(`{"type":"timeseries","title":"k8s panel"}`),
		})
		require.NoError(t, err)
		require.Equal(t, int64(42), dto.FolderID) //nolint:staticcheck

		row := readStoredFolder(t, sc, "k8s-create")
		require.Equal(t, int64(42), row.FolderID, "folder_id must be resolved from folder_uid")
		require.Equal(t, folderUID, row.FolderUID)
	})

	t.Run("create at the root keeps folder_id zero", func(t *testing.T) {
		sc := setupTestScenario(t)
		createK8sPanel(t, sc, "k8s-root", "")

		row := readStoredFolder(t, sc, "k8s-root")
		require.Equal(t, int64(0), row.FolderID)
		require.Equal(t, "", row.FolderUID)
	})

	t.Run("patch with only folder_uid keeps the panel in its folder", func(t *testing.T) {
		sc := setupTestScenario(t)
		const folderUID = "uid_for_target"
		sc.folderSvc.ExpectedFolder = &folder.Folder{ID: 42, OrgID: sc.user.OrgID, UID: folderUID, Title: "target"}
		createK8sPanel(t, sc, "k8s-patch", folderUID)

		// Mirror the k8s update path: only folder_uid set, folder_id unset, version
		// carried via the object generation (1 after create).
		fuid := folderUID
		_, err := sc.service.PatchLibraryElement(sc.reqContext.Req.Context(), &sc.user, model.PatchLibraryElementCommand{
			UID:       "k8s-patch",
			FolderUID: &fuid,
			Kind:      int64(model.PanelElement),
			Name:      "k8s panel edited",
			Version:   1,
			Model:     []byte(`{"type":"timeseries","title":"k8s panel edited"}`),
		}, "k8s-patch")
		require.NoError(t, err)

		row := readStoredFolder(t, sc, "k8s-patch")
		require.Equal(t, int64(42), row.FolderID, "folder_id must survive a folder_uid-only patch")
		require.Equal(t, folderUID, row.FolderUID, "folder_uid must not be wiped on patch")
	})

	t.Run("patch to a different folder updates both columns", func(t *testing.T) {
		sc := setupTestScenario(t)
		const srcUID, dstUID = "uid_src", "uid_dst"
		sc.folderSvc.ExpectedFolder = &folder.Folder{ID: 42, OrgID: sc.user.OrgID, UID: srcUID, Title: "src"}
		createK8sPanel(t, sc, "k8s-move", srcUID)

		// Move to the destination folder.
		sc.folderSvc.ExpectedFolder = &folder.Folder{ID: 99, OrgID: sc.user.OrgID, UID: dstUID, Title: "dst"}
		fuid := dstUID
		_, err := sc.service.PatchLibraryElement(sc.reqContext.Req.Context(), &sc.user, model.PatchLibraryElementCommand{
			UID:       "k8s-move",
			FolderUID: &fuid,
			Kind:      int64(model.PanelElement),
			Name:      "k8s panel",
			Version:   1,
			Model:     []byte(`{"type":"timeseries","title":"k8s panel"}`),
		}, "k8s-move")
		require.NoError(t, err)

		row := readStoredFolder(t, sc, "k8s-move")
		require.Equal(t, int64(99), row.FolderID)
		require.Equal(t, dstUID, row.FolderUID)
	})
}

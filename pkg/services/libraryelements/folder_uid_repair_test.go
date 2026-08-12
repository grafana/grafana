package libraryelements

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const repairOrgID = int64(1)

// repairFoldersByID resolves folders the way the repair does, by legacy ID.
type repairFoldersByID struct {
	*foldertest.FakeService
	byID map[int64]string
}

func (f *repairFoldersByID) Get(_ context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	uid, ok := f.byID[*q.ID] // nolint:staticcheck
	if !ok {
		return nil, dashboards.ErrFolderNotFound
	}
	return &folder.Folder{ID: *q.ID, OrgID: q.OrgID, UID: uid}, nil // nolint:staticcheck
}

// repairFailingFolders fails resolution with something other than "not found", which must
// leave the org unmarked rather than be treated as a missing folder.
type repairFailingFolders struct {
	*foldertest.FakeService
}

func (f *repairFailingFolders) Get(_ context.Context, _ *folder.GetFolderQuery) (*folder.Folder, error) {
	return nil, errors.New("folder lookup failed")
}

type repairFakeOrgs struct{}

func (repairFakeOrgs) Search(_ context.Context, _ *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return []*org.OrgDTO{{ID: repairOrgID}}, nil
}

func repairSetup(t *testing.T, byID map[int64]string) (*FolderUIDRepairService, db.DB) {
	t.Helper()
	store := db.InitTestDB(t)
	s := &FolderUIDRepairService{
		store:   store,
		folders: &repairFoldersByID{FakeService: foldertest.NewFakeService(), byID: byID},
		orgs:    repairFakeOrgs{},
		kv:      kvstore.NewFakeKVStore(),
		log:     log.New("test"),
	}
	return s, store
}

func repairInsert(t *testing.T, store db.DB, uid string, folderID int64, folderUID any) {
	t.Helper()
	repairInsertOrg(t, store, repairOrgID, uid, folderID, folderUID)
}

func repairInsertOrg(t *testing.T, store db.DB, orgID int64, uid string, folderID int64, folderUID any) {
	t.Helper()
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec(`INSERT INTO library_element
			(org_id, folder_id, folder_uid, uid, name, kind, type, description, model, version, created, created_by, updated, updated_by)
			VALUES (?, ?, ?, ?, ?, 1, 'timeseries', '', '{}', 1, '2024-01-01', 1, '2024-01-01', 1)`,
			orgID, folderID, folderUID, uid, uid)
		return err
	})
	require.NoError(t, err)
}

func repairStoredFolderID(t *testing.T, store db.DB, uid string) int64 {
	t.Helper()
	var got []int64
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.SQL("SELECT folder_id FROM library_element WHERE uid=?", uid).Find(&got)
	})
	require.NoError(t, err)
	require.Len(t, got, 1)
	return got[0]
}

// repairStoredUID returns nil for a NULL folder_uid, so tests can tell it apart from "".
func repairStoredUID(t *testing.T, store db.DB, uid string) any {
	t.Helper()
	var rows []struct {
		IsNull    bool   `xorm:"is_null"`
		FolderUID string `xorm:"folder_uid"`
	}
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.SQL(`SELECT CASE WHEN folder_uid IS NULL THEN 1 ELSE 0 END AS is_null,
			COALESCE(folder_uid, '') AS folder_uid FROM library_element WHERE uid=?`, uid).Find(&rows)
	})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	if rows[0].IsNull {
		return nil
	}
	return rows[0].FolderUID
}

func TestIntegration_RepairOrg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("repairs a folder_uid that drifted from folder_id", func(t *testing.T) {
		s, store := repairSetup(t, map[int64]string{2: "f2"})
		repairInsert(t, store, "drifted", 2, "f1")

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "f2", repairStoredUID(t, store, "drifted"))
	})

	t.Run("leaves a consistent row untouched", func(t *testing.T) {
		s, store := repairSetup(t, map[int64]string{2: "f2"})
		repairInsert(t, store, "consistent", 2, "f2")

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "f2", repairStoredUID(t, store, "consistent"))
	})

	t.Run("normalizes a NULL folder_uid at the root to empty", func(t *testing.T) {
		s, store := repairSetup(t, map[int64]string{2: "f2"})
		repairInsert(t, store, "null-root", 0, nil)

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "", repairStoredUID(t, store, "null-root"))
	})

	t.Run("normalizes a general folder_uid at the root to empty", func(t *testing.T) {
		s, store := repairSetup(t, map[int64]string{2: "f2"})
		repairInsert(t, store, "general-root", 0, folder.GeneralFolderUID)

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "", repairStoredUID(t, store, "general-root"))
	})

	t.Run("leaves an already empty folder_uid at the root untouched", func(t *testing.T) {
		s, store := repairSetup(t, map[int64]string{2: "f2"})
		repairInsert(t, store, "empty-root", 0, "")

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "", repairStoredUID(t, store, "empty-root"))
	})

	// folder_id is authoritative, and every read path already reports a folder_id=0 panel as
	// being in the general folder, so any UID left there is stale whatever it points at.
	t.Run("clears any folder_uid at the root", func(t *testing.T) {
		s, store := repairSetup(t, map[int64]string{2: "f2"})
		repairInsert(t, store, "live-uid", 0, "f2")
		repairInsert(t, store, "dead-uid", 0, "deleted-folder")

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "", repairStoredUID(t, store, "live-uid"))
		require.Equal(t, "", repairStoredUID(t, store, "dead-uid"))
		require.Equal(t, int64(0), repairStoredFolderID(t, store, "live-uid"))
	})

	t.Run("leaves the row alone when the folder no longer exists", func(t *testing.T) {
		s, store := repairSetup(t, nil)
		repairInsert(t, store, "orphan", 2, "f1")

		require.NoError(t, s.repairOrg(context.Background(), repairOrgID))
		require.Equal(t, "f1", repairStoredUID(t, store, "orphan"))
	})
}

func TestIntegration_Repair_MarksOrgOnce(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	s, store := repairSetup(t, map[int64]string{2: "f2"})
	repairInsert(t, store, "drifted", 2, "f1")

	require.NoError(t, s.repair(context.Background()))
	require.Equal(t, "f2", repairStoredUID(t, store, "drifted"))

	repaired, err := s.isOrgRepaired(context.Background(), repairOrgID)
	require.NoError(t, err)
	require.True(t, repaired)

	// A completed pass releases cleanup for every org, including ones created later.
	allowed, err := s.cleanupAllowed(context.Background())
	require.NoError(t, err)
	require.True(t, allowed)

	// A second pass must skip the org rather than repeat the work.
	repairInsert(t, store, "later-drift", 2, "f1")
	require.NoError(t, s.repair(context.Background()))
	require.Equal(t, "f1", repairStoredUID(t, store, "later-drift"))
}

func TestIntegration_Repair_LeavesCleanupGatedWhenAnOrgFails(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// No mapping for folder 2, and the fake returns a non-NotFound error, so repairOrg fails.
	s, store := repairSetup(t, nil)
	s.folders = &repairFailingFolders{}
	repairInsert(t, store, "drifted", 2, "f1")

	require.NoError(t, s.repair(context.Background()))

	allowed, err := s.cleanupAllowed(context.Background())
	require.NoError(t, err)
	require.False(t, allowed, "a partial pass must not release cleanup")
}

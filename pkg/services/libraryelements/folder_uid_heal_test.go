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

const healOrgID = int64(1)

// healFoldersByID resolves folders the way the heal job does, by legacy ID.
type healFoldersByID struct {
	*foldertest.FakeService
	byID map[int64]string
}

func (f *healFoldersByID) Get(_ context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	uid, ok := f.byID[*q.ID] // nolint:staticcheck
	if !ok {
		return nil, dashboards.ErrFolderNotFound
	}
	return &folder.Folder{ID: *q.ID, OrgID: q.OrgID, UID: uid}, nil // nolint:staticcheck
}

// healFailingFolders fails resolution with something other than "not found", which must
// leave the org unmarked rather than be treated as a missing folder.
type healFailingFolders struct {
	*foldertest.FakeService
}

func (f *healFailingFolders) Get(_ context.Context, _ *folder.GetFolderQuery) (*folder.Folder, error) {
	return nil, errors.New("folder lookup failed")
}

type healFakeOrgs struct{}

func (healFakeOrgs) Search(_ context.Context, _ *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return []*org.OrgDTO{{ID: healOrgID}}, nil
}

func healSetup(t *testing.T, byID map[int64]string) (*FolderUIDHealService, db.DB) {
	t.Helper()
	store := db.InitTestDB(t)
	s := &FolderUIDHealService{
		store:   store,
		folders: &healFoldersByID{FakeService: foldertest.NewFakeService(), byID: byID},
		orgs:    healFakeOrgs{},
		kv:      kvstore.NewFakeKVStore(),
		log:     log.New("test"),
	}
	return s, store
}

func healInsert(t *testing.T, store db.DB, uid string, folderID int64, folderUID any) {
	t.Helper()
	healInsertOrg(t, store, healOrgID, uid, folderID, folderUID)
}

func healInsertOrg(t *testing.T, store db.DB, orgID int64, uid string, folderID int64, folderUID any) {
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

// healStoredUID returns nil for a NULL folder_uid, so tests can tell it apart from "".
func healStoredUID(t *testing.T, store db.DB, uid string) any {
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

func TestIntegration_HealOrg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("heals a folder_uid that drifted from folder_id", func(t *testing.T) {
		s, store := healSetup(t, map[int64]string{2: "f2"})
		healInsert(t, store, "drifted", 2, "f1")

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "f2", healStoredUID(t, store, "drifted"))
	})

	t.Run("leaves a consistent row untouched", func(t *testing.T) {
		s, store := healSetup(t, map[int64]string{2: "f2"})
		healInsert(t, store, "consistent", 2, "f2")

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "f2", healStoredUID(t, store, "consistent"))
	})

	t.Run("normalizes a NULL folder_uid at the root to empty", func(t *testing.T) {
		s, store := healSetup(t, map[int64]string{2: "f2"})
		healInsert(t, store, "null-root", 0, nil)

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "", healStoredUID(t, store, "null-root"))
	})

	t.Run("normalizes a general folder_uid at the root to empty", func(t *testing.T) {
		s, store := healSetup(t, map[int64]string{2: "f2"})
		healInsert(t, store, "general-root", 0, folder.GeneralFolderUID)

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "", healStoredUID(t, store, "general-root"))
	})

	t.Run("leaves an already empty folder_uid at the root untouched", func(t *testing.T) {
		s, store := healSetup(t, map[int64]string{2: "f2"})
		healInsert(t, store, "empty-root", 0, "")

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "", healStoredUID(t, store, "empty-root"))
	})

	// The k8s create path wrote folder_id=0 with a real UID before it aligned folder_id,
	// so the panel lives in that folder and must not be moved to the root.
	t.Run("leaves a real folder_uid at the root untouched", func(t *testing.T) {
		s, store := healSetup(t, map[int64]string{2: "f2"})
		healInsert(t, store, "k8s-created", 0, "f2")

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "f2", healStoredUID(t, store, "k8s-created"))
	})

	t.Run("leaves the row alone when the folder no longer exists", func(t *testing.T) {
		s, store := healSetup(t, nil)
		healInsert(t, store, "orphan", 2, "f1")

		require.NoError(t, s.healOrg(context.Background(), healOrgID))
		require.Equal(t, "f1", healStoredUID(t, store, "orphan"))
	})
}

func TestIntegration_Heal_MarksOrgOnce(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	s, store := healSetup(t, map[int64]string{2: "f2"})
	healInsert(t, store, "drifted", 2, "f1")

	require.NoError(t, s.heal(context.Background()))
	require.Equal(t, "f2", healStoredUID(t, store, "drifted"))

	healed, err := s.isOrgHealed(context.Background(), healOrgID)
	require.NoError(t, err)
	require.True(t, healed)

	// A completed pass releases cleanup for every org, including ones created later.
	allowed, err := s.cleanupAllowed(context.Background())
	require.NoError(t, err)
	require.True(t, allowed)

	// A second pass must skip the org rather than repeat the work.
	healInsert(t, store, "later-drift", 2, "f1")
	require.NoError(t, s.heal(context.Background()))
	require.Equal(t, "f1", healStoredUID(t, store, "later-drift"))
}

func TestIntegration_Heal_LeavesCleanupGatedWhenAnOrgFails(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// No mapping for folder 2, and the fake returns a non-NotFound error, so healOrg fails.
	s, store := healSetup(t, nil)
	s.folders = &healFailingFolders{}
	healInsert(t, store, "drifted", 2, "f1")

	require.NoError(t, s.heal(context.Background()))

	allowed, err := s.cleanupAllowed(context.Background())
	require.NoError(t, err)
	require.False(t, allowed, "a partial pass must not release cleanup")
}

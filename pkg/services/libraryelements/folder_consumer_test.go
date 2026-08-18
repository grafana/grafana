package libraryelements

import (
	"context"
	"errors"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// logCtxValue looks up a key in the alternating key/value slice a log.Logger call receives.
func logCtxValue(t *testing.T, ctx []any, key string) any {
	t.Helper()
	for i := 0; i+1 < len(ctx); i += 2 {
		if ctx[i] == key {
			return ctx[i+1]
		}
	}
	t.Fatalf("key %q not found in log context %v", key, ctx)
	return nil
}

// enableRepairFlag turns the repair toggle on, which is what makes the cleanup gate apply.
func enableRepairFlag(t *testing.T) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(
		map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagLibraryElementFolderUIDRepair: {
				Key:            featuremgmt.FlagLibraryElementFolderUIDRepair,
				DefaultVariant: "enabled",
				Variants:       map[string]any{"enabled": true, "disabled": false},
			},
		})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

func markRepairComplete(t *testing.T, repair *FolderUIDRepairService) {
	t.Helper()
	require.NoError(t, repair.kv.Set(context.Background(), kvstore.AllOrganizations,
		repairKVNamespace, repairKVKeyAllOrgs, repairKVDone))
}

func consumerSetup(t *testing.T) (*FolderConsumer, db.DB, *FolderUIDRepairService) {
	t.Helper()
	store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	repair := &FolderUIDRepairService{store: store, kv: kvstore.NewFakeKVStore(), log: log.New("test")}
	svc := &LibraryElementService{SQLStore: store, log: log.New("test")}
	return ProvideFolderConsumer(svc, repair), store, repair
}

func TestIntegration_FolderConsumer_FoldersInUse(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// The repair ships disabled, so this is the default state: cleanup must not act on library
	// elements until a repair has actually run.
	t.Run("reports nothing until the repair has run", func(t *testing.T) {
		c, store, _ := consumerSetup(t)
		repairInsert(t, store, "panel", 2, "f2")

		uids, err := c.FoldersInUse(context.Background(), repairOrgID)
		require.NoError(t, err)
		require.Empty(t, uids)
	})

	t.Run("reports folders once the repair has completed a pass", func(t *testing.T) {
		c, store, repair := consumerSetup(t)
		repairInsert(t, store, "panel", 2, "f2")
		markRepairComplete(t, repair)

		uids, err := c.FoldersInUse(context.Background(), repairOrgID)
		require.NoError(t, err)
		require.Equal(t, []string{"f2"}, uids)
	})

	// An org created after the pass runs on code that keeps folder_uid in sync, so it has no
	// drift to repair and must not stay gated waiting for a per-org marker it will never get.
	t.Run("reports folders for an org created after the repair pass", func(t *testing.T) {
		c, store, repair := consumerSetup(t)
		markRepairComplete(t, repair)

		const newOrgID = int64(42)
		repairInsertOrg(t, store, newOrgID, "new-org-panel", 2, "f2")

		uids, err := c.FoldersInUse(context.Background(), newOrgID)
		require.NoError(t, err)
		require.Equal(t, []string{"f2"}, uids)
	})

	// Completion gates cleanup, not the toggle: enabling the repair is not the same as it
	// having finished.
	t.Run("stays gated when the repair is enabled but has not run", func(t *testing.T) {
		enableRepairFlag(t)
		c, store, _ := consumerSetup(t)
		repairInsert(t, store, "panel", 2, "f2")

		uids, err := c.FoldersInUse(context.Background(), repairOrgID)
		require.NoError(t, err)
		require.Empty(t, uids)
	})
}

// deleteConsumerSetup wires a FolderConsumer with the repair already marked complete and an
// observable logger, ready to exercise DeleteInFolder. dashboardsErr, if non-nil, is returned by
// the dashboard-lookup dependency instead of an empty connected-dashboards list.
func deleteConsumerSetup(t *testing.T, dashboardsErr error) (*FolderConsumer, db.DB, *logtest.Fake) {
	t.Helper()
	store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	repair := &FolderUIDRepairService{store: store, kv: kvstore.NewFakeKVStore(), log: log.New("test")}
	markRepairComplete(t, repair)

	dashSvc := dashboards.NewFakeDashboardService(t)
	dashSvc.On("GetDashboardsByLibraryPanelUID", mock.Anything, mock.Anything, mock.Anything).
		Return([]*dashboards.DashboardRef{}, dashboardsErr).Maybe()

	svc := &LibraryElementService{SQLStore: store, log: log.New("test"), dashboardsService: dashSvc}
	c := ProvideFolderConsumer(svc, repair)
	fakeLog := &logtest.Fake{}
	c.log = fakeLog
	return c, store, fakeLog
}

func insertLibraryElement(t *testing.T, store db.DB, uid, name, folderUID string) {
	t.Helper()
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec(`INSERT INTO library_element
			(org_id, folder_id, folder_uid, uid, name, kind, type, description, model, version, created, created_by, updated, updated_by)
			VALUES (?, 0, ?, ?, ?, 1, 'timeseries', '', '{}', 1, '2024-01-01', 1, '2024-01-01', 1)`,
			repairOrgID, folderUID, uid, name)
		return err
	})
	require.NoError(t, err)
}

func TestIntegration_FolderConsumer_DeleteInFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("logs uid and name of deleted elements", func(t *testing.T) {
		c, store, fakeLog := deleteConsumerSetup(t, nil)
		insertLibraryElement(t, store, "panel-1", "CPU usage", "f1")
		insertLibraryElement(t, store, "panel-2", "Memory usage", "f1")

		require.NoError(t, c.DeleteInFolder(context.Background(), repairOrgID, "f1"))

		require.Equal(t, 1, fakeLog.InfoLogs.Calls)
		require.Equal(t, "Deleted library elements in deleted folder", fakeLog.InfoLogs.Message)
		require.ElementsMatch(t, []string{"panel-1 (CPU usage)", "panel-2 (Memory usage)"},
			logCtxValue(t, fakeLog.InfoLogs.Ctx, "elements"))
		require.Equal(t, 2, logCtxValue(t, fakeLog.InfoLogs.Ctx, "count"))
		require.Equal(t, "f1", logCtxValue(t, fakeLog.InfoLogs.Ctx, "folder_uid"))

		var remaining []string
		err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
			return sess.SQL("SELECT uid FROM library_element WHERE folder_uid=?", "f1").Find(&remaining)
		})
		require.NoError(t, err)
		require.Empty(t, remaining)
	})

	t.Run("does not log when there is nothing to delete", func(t *testing.T) {
		c, _, fakeLog := deleteConsumerSetup(t, nil)

		require.NoError(t, c.DeleteInFolder(context.Background(), repairOrgID, "empty-folder"))
		require.Equal(t, 0, fakeLog.InfoLogs.Calls)
	})

	t.Run("does not log when the dashboard lookup fails", func(t *testing.T) {
		lookupErr := errors.New("dashboard lookup failed")
		c, store, fakeLog := deleteConsumerSetup(t, lookupErr)
		insertLibraryElement(t, store, "panel-1", "CPU usage", "f1")

		err := c.DeleteInFolder(context.Background(), repairOrgID, "f1")
		require.ErrorIs(t, err, lookupErr)
		require.Equal(t, 0, fakeLog.InfoLogs.Calls)

		var remaining []string
		dbErr := store.WithDbSession(context.Background(), func(sess *db.Session) error {
			return sess.SQL("SELECT uid FROM library_element WHERE folder_uid=?", "f1").Find(&remaining)
		})
		require.NoError(t, dbErr)
		require.Equal(t, []string{"panel-1"}, remaining)
	})

	t.Run("does not report an element moved out of the folder before delete", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		repair := &FolderUIDRepairService{store: store, kv: kvstore.NewFakeKVStore(), log: log.New("test")}
		markRepairComplete(t, repair)
		insertLibraryElement(t, store, "panel-1", "CPU usage", "f1")
		insertLibraryElement(t, store, "panel-2", "Memory usage", "f1")

		dashSvc := dashboards.NewFakeDashboardService(t)
		// The dashboard-connection check is the last read before the delete, so use it to land a
		// concurrent move out of the folder right in the middle of DeleteInFolder's own work.
		dashSvc.On("GetDashboardsByLibraryPanelUID", mock.Anything, "panel-1", mock.Anything).
			Run(func(mock.Arguments) {
				moveErr := store.WithDbSession(context.Background(), func(sess *db.Session) error {
					_, err := sess.Exec("UPDATE library_element SET folder_uid=? WHERE uid=?", "f2", "panel-1")
					return err
				})
				require.NoError(t, moveErr)
			}).
			Return([]*dashboards.DashboardRef{}, nil)
		dashSvc.On("GetDashboardsByLibraryPanelUID", mock.Anything, "panel-2", mock.Anything).
			Return([]*dashboards.DashboardRef{}, nil)

		svc := &LibraryElementService{SQLStore: store, log: log.New("test"), dashboardsService: dashSvc}
		c := ProvideFolderConsumer(svc, repair)
		fakeLog := &logtest.Fake{}
		c.log = fakeLog

		require.NoError(t, c.DeleteInFolder(context.Background(), repairOrgID, "f1"))

		require.Equal(t, 1, fakeLog.InfoLogs.Calls)
		require.Equal(t, []string{"panel-2 (Memory usage)"}, logCtxValue(t, fakeLog.InfoLogs.Ctx, "elements"))

		var movedFolder string
		err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.SQL("SELECT folder_uid FROM library_element WHERE uid=?", "panel-1").Get(&movedFolder)
			return err
		})
		require.NoError(t, err)
		require.Equal(t, "f2", movedFolder)
	})
}

package ngalert

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegration_BackfillFolderFullpaths(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	t.Run("no organizations needs no rule store", func(t *testing.T) {
		ng, _, _ := newBackfillTestService(t, 0)
		ng.ruleStore = nil

		require.NoError(t, ng.BackfillFolderFullpaths(context.Background()))
	})

	t.Run("only selects folders with NULL fullpaths and deduplicates within each org", func(t *testing.T) {
		ng, folders, _ := newBackfillTestService(t, 3)
		for _, orgID := range []int64{1, 2} {
			seedBackfillRule(t, ng, orgID, "shared", fmt.Sprintf("missing-%d-a", orgID), nil)
			seedBackfillRule(t, ng, orgID, "shared", fmt.Sprintf("missing-%d-b", orgID), nil)
		}
		seedBackfillRule(t, ng, 1, "populated", "populated", "keep this path")
		seedBackfillRule(t, ng, 1, "empty", "empty", "")
		seedBackfillRule(t, ng, 1, "shared", "mixed", "old path")
		folders.calls = nil

		require.NoError(t, ng.BackfillFolderFullpaths(context.Background()))

		require.Len(t, folders.calls, 2)
		orgIDs := make([]int64, 0, len(folders.calls))
		for _, call := range folders.calls {
			orgIDs = append(orgIDs, call.OrgID)
			assert.Equal(t, []string{"shared"}, call.UIDs)
			assert.True(t, call.WithFullpath)
		}
		assert.ElementsMatch(t, []int64{1, 2}, orgIDs)
		for _, orgID := range []int64{1, 2} {
			for _, suffix := range []string{"a", "b"} {
				assert.Equal(t, sql.NullString{String: fmt.Sprintf("org-%d/shared", orgID), Valid: true}, readBackfillPath(t, ng.SQLStore, orgID, fmt.Sprintf("missing-%d-%s", orgID, suffix)))
			}
		}
		assert.Equal(t, sql.NullString{String: "keep this path", Valid: true}, readBackfillPath(t, ng.SQLStore, 1, "populated"))
		assert.Equal(t, sql.NullString{Valid: true}, readBackfillPath(t, ng.SQLStore, 1, "empty"))
		assert.Equal(t, sql.NullString{String: "org-1/shared", Valid: true}, readBackfillPath(t, ng.SQLStore, 1, "mixed"), "the existing write updates every rule in a selected folder")

		folders.calls = nil
		require.NoError(t, ng.BackfillFolderFullpaths(context.Background()))
		assert.Empty(t, folders.calls, "a second backfill must not resolve folders again")
	})

	t.Run("provider receives each org identity and a failed org does not stop backfill", func(t *testing.T) {
		ng, folders, sqlRules := newBackfillTestService(t, 2)
		orgIDs, err := ng.store.FetchOrgIds(context.Background())
		require.NoError(t, err)
		for _, orgID := range orgIDs {
			seedBackfillRule(t, ng, orgID, "shared", "missing", nil)
		}
		folders.calls = nil
		var resolvedOrgs []int64
		sqlRules.LegacyDatabaseProvider = func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			requester, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			resolvedOrgs = append(resolvedOrgs, requester.GetOrgID())
			if requester.GetOrgID() == orgIDs[0] {
				return nil, legacysql.ErrNamespaceNotFound
			}
			return legacysql.NewDatabaseProvider(ng.SQLStore)(ctx)
		}

		require.NoError(t, ng.BackfillFolderFullpaths(context.Background()))

		assert.Equal(t, orgIDs, resolvedOrgs)
		require.Len(t, folders.calls, 1)
		assert.Equal(t, orgIDs[1], folders.calls[0].OrgID)
		assert.Equal(t, sql.NullString{}, readBackfillPath(t, ng.SQLStore, orgIDs[0], "missing"))
		assert.Equal(t, sql.NullString{String: fmt.Sprintf("org-%d/shared", orgIDs[1]), Valid: true}, readBackfillPath(t, ng.SQLStore, orgIDs[1], "missing"))
	})

	for _, tc := range []struct {
		name   string
		failAt int
	}{
		{name: "folder read failure continues with next org", failAt: 1},
		{name: "fullpath write failure continues with next org", failAt: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ng, folders, sqlRules := newBackfillTestService(t, 2)
			orgIDs, err := ng.store.FetchOrgIds(context.Background())
			require.NoError(t, err)
			require.Len(t, orgIDs, 2)
			for _, orgID := range orgIDs {
				seedBackfillRule(t, ng, orgID, "shared", "missing", nil)
			}
			folders.calls = nil
			injected := errors.New("backfill database failure")
			faultDB := &backfillSessionDB{DB: ng.SQLStore, before: func(call int) error {
				if call == tc.failAt {
					return injected
				}
				return nil
			}}
			sqlRules.SQLStore = faultDB

			require.NoError(t, ng.BackfillFolderFullpaths(context.Background()))

			assert.Equal(t, sql.NullString{}, readBackfillPath(t, ng.SQLStore, orgIDs[0], "missing"))
			assert.Equal(t, sql.NullString{String: fmt.Sprintf("org-%d/shared", orgIDs[1]), Valid: true}, readBackfillPath(t, ng.SQLStore, orgIDs[1], "missing"))
			assert.Equal(t, tc.failAt+2, faultDB.calls)
		})
	}

	t.Run("folder service failure leaves paths missing and continues with next org", func(t *testing.T) {
		ng, folders, _ := newBackfillTestService(t, 2)
		orgIDs, err := ng.store.FetchOrgIds(context.Background())
		require.NoError(t, err)
		for _, orgID := range orgIDs {
			seedBackfillRule(t, ng, orgID, "shared", "missing", nil)
		}
		folders.failOrg = orgIDs[0]

		require.NoError(t, ng.BackfillFolderFullpaths(context.Background()))

		assert.Equal(t, sql.NullString{}, readBackfillPath(t, ng.SQLStore, orgIDs[0], "missing"))
		assert.Equal(t, sql.NullString{String: fmt.Sprintf("org-%d/shared", orgIDs[1]), Valid: true}, readBackfillPath(t, ng.SQLStore, orgIDs[1], "missing"))
	})

	t.Run("organization fetch failure is returned without reading rules", func(t *testing.T) {
		injected := errors.New("organization database unavailable")
		ng := &AlertNG{store: &store.DBstore{SQLStore: &backfillSessionDB{before: func(int) error { return injected }}}}

		err := ng.BackfillFolderFullpaths(context.Background())

		require.ErrorIs(t, err, injected)
		assert.ErrorContains(t, err, "failed to fetch organizations")
	})

	t.Run("cancellation between orgs stops further reads", func(t *testing.T) {
		ng, folders, sqlRules := newBackfillTestService(t, 2)
		orgIDs, err := ng.store.FetchOrgIds(context.Background())
		require.NoError(t, err)
		for _, orgID := range orgIDs {
			seedBackfillRule(t, ng, orgID, "shared", "missing", nil)
		}
		folders.calls = nil
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		faultDB := &backfillSessionDB{DB: ng.SQLStore, after: func(call int) {
			if call == 2 {
				cancel()
			}
		}}
		sqlRules.SQLStore = faultDB

		require.ErrorIs(t, ng.BackfillFolderFullpaths(ctx), context.Canceled)

		assert.Equal(t, 2, faultDB.calls)
		require.Len(t, folders.calls, 1)
		assert.Equal(t, sql.NullString{String: fmt.Sprintf("org-%d/shared", orgIDs[0]), Valid: true}, readBackfillPath(t, ng.SQLStore, orgIDs[0], "missing"))
		assert.Equal(t, sql.NullString{}, readBackfillPath(t, ng.SQLStore, orgIDs[1], "missing"))
	})
}

type backfillSessionDB struct {
	db.DB
	calls  int
	before func(int) error
	after  func(int)
}

func (d *backfillSessionDB) WithDbSession(ctx context.Context, fn sqlstore.DBTransactionFunc) error {
	d.calls++
	if d.before != nil {
		if err := d.before(d.calls); err != nil {
			return err
		}
	}
	err := d.DB.WithDbSession(ctx, fn)
	if d.after != nil {
		d.after(d.calls)
	}
	return err
}

type backfillFolderService struct {
	folder.Service
	calls   []folder.GetFoldersQuery
	failOrg int64
}

func (f *backfillFolderService) GetFolders(_ context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	f.calls = append(f.calls, q)
	if q.OrgID == f.failOrg {
		return nil, errors.New("folder service unavailable")
	}
	result := make([]*folder.Folder, 0, len(q.UIDs))
	for _, uid := range q.UIDs {
		result = append(result, &folder.Folder{OrgID: q.OrgID, UID: uid, Fullpath: fmt.Sprintf("org-%d/%s", q.OrgID, uid)})
	}
	return result, nil
}

func newBackfillTestService(t *testing.T, orgCount int) (*AlertNG, *backfillFolderService, *rules.RuleStore) {
	t.Helper()
	sqlStore := db.NewTestStore(t, db.WithoutDefaultOrgAndUser())
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		for i := 1; i <= orgCount; i++ {
			if _, err := sess.Insert(&org.Org{ID: int64(i), Name: fmt.Sprintf("backfill-org-%d", i), Created: time.Now(), Updated: time.Now()}); err != nil {
				return err
			}
		}
		return nil
	}))
	folders := &backfillFolderService{Service: foldertest.NewFakeService()}
	logger := log.NewNopLogger()
	sqlRules := &rules.RuleStore{
		SQLStore:      sqlStore,
		Logger:        logger,
		FolderService: folders,
		Cfg:           setting.UnifiedAlertingSettings{BaseInterval: time.Second},
	}
	ruleService, err := rules.ProvideService(sqlRules, folders)
	require.NoError(t, err)
	return &AlertNG{
		SQLStore:  sqlStore,
		Log:       logger,
		store:     &store.DBstore{SQLStore: sqlStore, Logger: logger},
		ruleStore: ruleService,
	}, folders, sqlRules
}

func seedBackfillRule(t *testing.T, ng *AlertNG, orgID int64, folderUID, uid string, fullpath any) {
	t.Helper()
	rule := models.RuleGen.With(
		models.RuleGen.WithOrgID(orgID),
		models.RuleGen.WithNamespaceUID(folderUID),
		models.RuleGen.WithIntervalMatching(time.Second),
	).Generate()
	rule.UID = uid
	_, err := ng.ruleStore.InsertAlertRules(context.Background(), nil, []models.InsertRule{{AlertRule: rule}})
	require.NoError(t, err)
	require.NoError(t, ng.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE alert_rule SET folder_fullpath = ? WHERE org_id = ? AND uid = ?", fullpath, orgID, uid)
		return err
	}))
}

func readBackfillPath(t *testing.T, sqlStore db.DB, orgID int64, uid string) sql.NullString {
	t.Helper()
	var row struct{ FolderFullpath sql.NullString }
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		found, err := sess.SQL("SELECT folder_fullpath FROM alert_rule WHERE org_id = ? AND uid = ?", orgID, uid).Get(&row)
		if err == nil && !found {
			return fmt.Errorf("rule %s not found in org %d", uid, orgID)
		}
		return err
	}))
	return row.FolderFullpath
}

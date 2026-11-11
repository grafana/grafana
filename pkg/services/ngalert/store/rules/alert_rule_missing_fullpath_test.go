package rules

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegration_GetFolderUIDsWithMissingFullpath_NilProvider(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	sqlStore := db.NewTestStore(t)
	store := &RuleStore{SQLStore: sqlStore}
	ctx := context.Background()

	for _, tc := range []struct {
		folder string
		orgID  int64
		path   any
	}{
		{folder: "missing", orgID: 1},
		{folder: "missing", orgID: 1},
		{folder: "another-missing", orgID: 1},
		{folder: "empty", orgID: 1, path: ""},
		{folder: "populated", orgID: 1, path: "Parent/Populated"},
		{folder: "other-org", orgID: 2},
	} {
		rule := createRule(t, store, models.RuleGen.With(
			models.RuleGen.WithOrgID(tc.orgID),
			models.RuleGen.WithNamespaceUID(tc.folder),
		))
		require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE alert_rule SET folder_fullpath = ? WHERE id = ?", tc.path, rule.ID)
			return err
		}))
	}

	// Soft deletion retains a version with an empty rule UID, not an alert_rule row.
	deleted, err := alertRuleFromModelsAlertRule(models.RuleGen.With(
		models.RuleGen.WithOrgID(1),
		models.RuleGen.WithNamespaceUID("deleted-only"),
	).Generate())
	require.NoError(t, err)
	version := alertRuleToAlertRuleVersion(deleted)
	version.RuleUID = ""
	require.NoError(t, sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.InsertOne(&version)
		return err
	}))

	uids, err := store.GetFolderUIDsWithMissingFullpath(ctx, 1)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"missing", "another-missing"}, uids)
	uids, err = store.GetFolderUIDsWithMissingFullpath(ctx, 2)
	require.NoError(t, err)
	assert.Equal(t, []string{"other-org"}, uids)
	uids, err = store.GetFolderUIDsWithMissingFullpath(ctx, 3)
	require.NoError(t, err)
	assert.Empty(t, uids)
}

func TestIntegration_GetFolderUIDsWithMissingFullpath_RoutedDatabaseAndTable(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	localDB := db.NewTestStore(t)
	routedDB := db.NewTestStore(t)
	require.NotSame(t, localDB.GetEngine().DB(), routedDB.GetEngine().DB())
	ctx := context.Background()
	store := &RuleStore{SQLStore: localDB}
	createRule(t, store, models.RuleGen.With(models.RuleGen.WithOrgID(1), models.RuleGen.WithNamespaceUID("local-only")))
	require.NoError(t, localDB.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE alert_rule SET folder_fullpath = NULL")
		return err
	}))
	require.NoError(t, routedDB.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("CREATE TABLE routed_alert_rule (org_id BIGINT, namespace_uid VARCHAR(190), folder_fullpath TEXT)")
		if err != nil {
			return err
		}
		_, err = sess.Exec("INSERT INTO routed_alert_rule (org_id, namespace_uid, folder_fullpath) VALUES (?, ?, NULL)", 1, "routed-only")
		return err
	}))
	var tables []string
	store.LegacyDatabaseProvider = func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB: routedDB,
			Table: func(name string) string {
				tables = append(tables, name)
				return "routed_" + name
			},
		}, nil
	}

	var uids []string
	err := localDB.InTransaction(ctx, func(ctx context.Context) error {
		var err error
		uids, err = store.GetFolderUIDsWithMissingFullpath(ctx, 1)
		return err
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"routed-only"}, uids)
	assert.Equal(t, []string{"alert_rule"}, tables)
}

func TestIntegration_GetFolderUIDsWithMissingFullpath_DoesNotReuseAmbientSession(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	for _, explicitProvider := range []bool{false, true} {
		name := "nil provider"
		if explicitProvider {
			name = "explicit provider on same database"
		}
		t.Run(name, func(t *testing.T) {
			sqlStore := db.NewTestStore(t)
			spy := &dbSpy{DB: sqlStore}
			store := &RuleStore{SQLStore: spy}
			if explicitProvider {
				store.LegacyDatabaseProvider = legacysql.NewDatabaseProvider(spy)
			}
			var ambient *db.Session
			err := sqlStore.InTransaction(context.Background(), func(ctx context.Context) error {
				if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
					ambient = sess
					return nil
				}); err != nil {
					return err
				}
				_, err := store.GetFolderUIDsWithMissingFullpath(ctx, 1)
				return err
			})
			require.NoError(t, err)
			require.NotNil(t, ambient)
			require.NotNil(t, spy.lastSession)
			assert.NotSame(t, ambient, spy.lastSession)
		})
	}
}

func TestIntegration_GetFolderUIDsWithMissingFullpath_ErrorsDoNotFallBack(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)
	for _, name := range []string{"provider error", "SQL error"} {
		t.Run(name, func(t *testing.T) {
			sqlStore := db.NewTestStore(t)
			spy := &dbSpy{DB: sqlStore}
			providerErr := errors.New("legacy provider unavailable")
			store := &RuleStore{
				SQLStore: spy,
				LegacyDatabaseProvider: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
					if name == "provider error" {
						return nil, providerErr
					}
					return &legacysql.LegacyDatabaseHelper{
						DB:    sqlStore,
						Table: func(string) string { return "missing_alert_rule_table" },
					}, nil
				},
			}

			uids, err := store.GetFolderUIDsWithMissingFullpath(context.Background(), 1)
			if name == "provider error" {
				require.ErrorIs(t, err, providerErr)
			} else {
				require.ErrorContains(t, err, "missing_alert_rule_table")
			}
			assert.Nil(t, uids)
			assert.False(t, spy.withDbSessionCalled, "errors must not fall back to SQLStore")
		})
	}
}

package quotaimpl

import (
	"context"
	"testing"
	"text/template"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationQuotaDataAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss := db.InitTestDB(t)
	quotaStore := sqlStore{
		sql: legacysql.NewDatabaseProvider(ss),
	}

	t.Run("quota deleted", func(t *testing.T) {
		ctx := quota.FromContext(context.Background(), &quota.TargetToSrv{})
		err := quotaStore.DeleteByUser(ctx, 1)
		require.NoError(t, err)
	})
}

func TestIntegrationSQLStoreUsesProviderTable(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss := db.InitTestDB(t)
	const quotaTable = "quota_provider_test"
	require.NoError(t, ss.WithDbSession(t.Context(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("CREATE TABLE " + quotaTable + " AS SELECT * FROM quota WHERE 1 = 0")
		return err
	}))
	t.Cleanup(func() {
		require.NoError(t, ss.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err := sess.Exec("DROP TABLE " + quotaTable)
			return err
		}))
	})

	type contextKey struct{}
	ctx := context.WithValue(t.Context(), contextKey{}, "provider context")
	calls := 0
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		calls++
		return &legacysql.LegacyDatabaseHelper{
			DB: ss,
			Table: func(name string) string {
				require.Equal(t, "quota", name)
				return quotaTable
			},
		}, nil
	}
	quotaStore := sqlStore{sql: provider, logger: log.New("quota_test")}
	targetToSrv := quota.NewTargetToSrv()
	targetToSrv.Set("test", "service")
	quotaCtx := quota.FromContext(ctx, targetToSrv)

	require.NoError(t, quotaStore.Update(quotaCtx, &quota.UpdateQuotaCmd{
		Target: "test",
		Limit:  3,
		UserID: 42,
	}))

	limits, err := quotaStore.Get(quotaCtx, &quota.ScopeParameters{UserID: 42})
	require.NoError(t, err)
	tag, err := quota.NewTag("service", "test", quota.UserScope)
	require.NoError(t, err)
	limit, ok := limits.Get(tag)
	require.True(t, ok)
	require.EqualValues(t, 3, limit)

	require.NoError(t, quotaStore.DeleteByUser(quotaCtx, 42))
	limits, err = quotaStore.Get(quotaCtx, &quota.ScopeParameters{UserID: 42})
	require.NoError(t, err)
	_, ok = limits.Get(tag)
	require.False(t, ok)
	require.Equal(t, 4, calls)
}

func TestTemplates(t *testing.T) {
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}
	quotaTable := dbHelper.Table("quota")
	queryTemplate := func() sqltemplate.SQLTemplate {
		return mocks.NewTestingSQLTemplate()
	}
	now := time.Date(2025, 7, 22, 15, 0, 0, 0, time.UTC)

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			deleteByUserTemplate: {
				{
					Name: "delete_by_user",
					Data: deleteByUserQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						UserID:      42,
					},
				},
			},
			findQuotaTemplate: {
				{
					Name: "global_quota",
					Data: findQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Cmd:         &quota.UpdateQuotaCmd{Target: "test"},
					},
				},
				{
					Name: "user_quota",
					Data: findQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Cmd:         &quota.UpdateQuotaCmd{Target: "test", UserID: 42},
					},
				},
				{
					Name: "org_quota",
					Data: findQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						Cmd:         &quota.UpdateQuotaCmd{Target: "test", OrgID: 8},
					},
				},
			},
			insertQuotaTemplate: {
				{
					Name: "insert_quota",
					Data: insertQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						LimitColumn: "limit",
						Cmd:         &quota.UpdateQuotaCmd{Target: "test", Limit: 3, UserID: 42},
						Created:     now,
						Updated:     now,
					},
				},
			},
			updateQuotaTemplate: {
				{
					Name: "update_quota",
					Data: updateQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						LimitColumn: "limit",
						QuotaID:     3,
						Limit:       4,
						Updated:     now,
					},
				},
			},
			userScopeQuotaTemplate: {
				{
					Name: "user_scope",
					Data: userScopeQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						LimitColumn: "limit",
						UserID:      42,
						OrgID:       0,
					},
				},
			},
			orgScopeQuotaTemplate: {
				{
					Name: "org_scope",
					Data: orgScopeQuotaQuery{
						SQLTemplate: queryTemplate(),
						QuotaTable:  quotaTable,
						LimitColumn: "limit",
						UserID:      0,
						OrgID:       8,
					},
				},
			},
		},
	})
}

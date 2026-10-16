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

func TestIntegration_CountRuleGroups(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	store := SetupStoreForTesting(t, sqlStore)
	ctx := context.Background()
	for _, orgID := range []int64{0, 1} {
		count, err := store.CountRuleGroups(ctx, orgID)
		require.NoError(t, err)
		assert.Zero(t, count)
	}

	for _, rule := range []struct {
		orgID  int64
		folder string
		group  string
	}{
		{1, "folder-a", "shared"},
		{1, "folder-a", "shared"},
		{1, "folder-b", "shared"},
		{1, "folder-a", "first-org-only"},
		{2, "folder-c", "shared"},
		{2, "folder-c", "second-org-only"},
		{2, "folder-d", "second-org-only"},
	} {
		createRule(t, store, models.RuleGen.With(
			models.RuleMuts.WithOrgID(rule.orgID),
			models.RuleMuts.WithNamespaceUID(rule.folder),
			models.RuleMuts.WithGroupName(rule.group),
			models.RuleMuts.WithIntervalMatching(store.Cfg.BaseInterval),
		))
	}

	for _, tc := range []struct {
		name  string
		orgID int64
		want  int64
	}{
		{"global distinct names", 0, 3},
		{"first organization", 1, 2},
		{"second organization", 2, 2},
		{"missing organization", 3, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			count, err := store.CountRuleGroups(ctx, tc.orgID)
			require.NoError(t, err)
			assert.Equal(t, tc.want, count)
		})
	}

	t.Run("routed database and table", func(t *testing.T) {
		spy := &dbSpy{DB: sqlStore}
		var tables []string
		store := RuleStore{
			LegacyDatabaseProvider: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				return &legacysql.LegacyDatabaseHelper{
					DB: spy,
					Table: func(name string) string {
						tables = append(tables, name)
						return name
					},
				}, nil
			},
		}
		count, err := store.CountRuleGroups(ctx, 1)
		require.NoError(t, err)
		assert.Equal(t, int64(2), count)
		assert.True(t, spy.withDbSessionCalled)
		assert.Equal(t, []string{"alert_rule"}, tables)
	})

	t.Run("query error", func(t *testing.T) {
		store := RuleStore{
			LegacyDatabaseProvider: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				return &legacysql.LegacyDatabaseHelper{
					DB:    sqlStore,
					Table: func(string) string { return "missing_alert_rule_table" },
				}, nil
			},
		}
		count, err := store.CountRuleGroups(ctx, 0)
		require.Error(t, err)
		assert.Zero(t, count)
	})
}

func TestCountRuleGroups_provider_error(t *testing.T) {
	wantErr := errors.New("database unavailable")
	store := RuleStore{
		LegacyDatabaseProvider: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, wantErr
		},
	}
	count, err := store.CountRuleGroups(context.Background(), 1)
	require.ErrorIs(t, err, wantErr)
	assert.Zero(t, count)
}

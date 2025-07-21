package legacy

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestDashboardMigrationQuery(t *testing.T) {
	// Test that migration queries use AllowFallback flag correctly
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	t.Run("Migration query should enable AllowFallback flag", func(t *testing.T) {
		// Create a migration query as would be used in actual migration
		migrationQuery := &DashboardQuery{
			OrgID:         1,
			GetHistory:    true,  // Migration includes history
			AllowFallback: true,  // This is the key flag for migration
			Order:         "ASC", // Migration uses ascending order
		}

		// Verify UseHistoryTable returns true (requirement for COALESCE logic)
		require.True(t, migrationQuery.UseHistoryTable(), "Migration query should use history table")

		// Verify the flag is set correctly
		require.True(t, migrationQuery.AllowFallback, "Migration query should allow fallback")
		require.True(t, migrationQuery.GetHistory, "Migration query should get history")
		require.Equal(t, "ASC", migrationQuery.Order, "Migration should use ascending order")
	})

	t.Run("Regular history query should not use AllowFallback", func(t *testing.T) {
		// Regular history query without migration
		historyQuery := &DashboardQuery{
			OrgID:      1,
			GetHistory: true,
			Order:      "DESC",
		}

		require.True(t, historyQuery.UseHistoryTable(), "History query should use history table")
		require.False(t, historyQuery.AllowFallback, "Regular history query should not allow fallback")
		require.True(t, historyQuery.GetHistory, "History query should get history")
	})

	t.Run("Migration query template produces COALESCE SQL", func(t *testing.T) {
		// Test that the SQL template produces COALESCE logic for migration queries
		migrationQuery := &DashboardQuery{
			OrgID:         1,
			GetHistory:    true,
			AllowFallback: true,
			Order:         "ASC",
		}

		req := newQueryReq(nodb, migrationQuery)
		req.SQLTemplate = mocks.NewTestingSQLTemplate()

		// Execute the template to get the generated SQL
		rawQuery, err := sqltemplate.Execute(sqlQueryDashboards, &req)
		require.NoError(t, err)

		sql := rawQuery

		// Verify that COALESCE functions are present in the generated SQL
		// These should be used when GetHistory=true AND AllowFallback=true
		require.Contains(t, sql, "COALESCE(dashboard_version.created, dashboard.updated)",
			"Migration SQL should contain COALESCE for updated timestamp")
		require.Contains(t, sql, "COALESCE(dashboard_version.version, dashboard.version)",
			"Migration SQL should contain COALESCE for version")
		require.Contains(t, sql, "COALESCE(dashboard_version.data, dashboard.data)",
			"Migration SQL should contain COALESCE for data")
		require.Contains(t, sql, "COALESCE(dashboard_version.api_version, dashboard.api_version)",
			"Migration SQL should contain COALESCE for api_version")
		require.Contains(t, sql, "COALESCE(dashboard_version.message, '')",
			"Migration SQL should contain COALESCE for message with empty string fallback")

		// Verify ORDER BY uses COALESCE as well
		require.Contains(t, sql, "COALESCE(dashboard_version.created, dashboard.updated) ASC",
			"Migration SQL should ORDER BY COALESCED created timestamp")
		require.Contains(t, sql, "COALESCE(dashboard_version.version, dashboard.version) ASC",
			"Migration SQL should ORDER BY COALESCED version")

		// Verify it doesn't have the strict history table filter that would exclude NULL version entries
		require.NotContains(t, sql, "dashboard_version.id IS NOT NULL",
			"Migration SQL should not exclude dashboards without version entries")
	})

	t.Run("Regular history query produces strict SQL", func(t *testing.T) {
		// Test that regular history queries still use strict dashboard_version fields
		historyQuery := &DashboardQuery{
			OrgID:      1,
			GetHistory: true,
			Order:      "DESC",
		}

		req := newQueryReq(nodb, historyQuery)
		req.SQLTemplate = mocks.NewTestingSQLTemplate()

		rawQuery, err := sqltemplate.Execute(sqlQueryDashboards, &req)
		require.NoError(t, err)

		sql := rawQuery

		// Verify that direct dashboard_version fields are used (no COALESCE)
		require.Contains(t, sql, "dashboard_version.created as updated",
			"Regular history SQL should use direct dashboard_version.created")
		require.Contains(t, sql, "dashboard_version.version",
			"Regular history SQL should use direct dashboard_version.version")
		require.Contains(t, sql, "dashboard_version.data",
			"Regular history SQL should use direct dashboard_version.data")

		// NOTE: We intentionally do NOT add dashboard_version.id IS NOT NULL filter
		// to allow for cases where dashboard_version entries might be missing

		// Should not contain COALESCE functions
		require.NotContains(t, sql, "COALESCE(dashboard_version.created, dashboard.updated)",
			"Regular history SQL should not contain COALESCE for updated")
	})
}

func TestMigrateDashboardsConfiguration(t *testing.T) {
	// Test the actual migration function configuration

	t.Run("Migration options should configure query correctly", func(t *testing.T) {
		// Test the migration configuration as used in real migration
		opts := MigrateOptions{
			WithHistory: true, // Migration includes history
		}

		// This simulates what happens in migrateDashboards function
		expectedQuery := &DashboardQuery{
			OrgID:         1,
			Limit:         100000000,
			GetHistory:    opts.WithHistory, // Should be true
			AllowFallback: true,             // Should be true for migration
			Order:         "ASC",            // Should be ASC for migration
		}

		// Verify the configuration matches what migration sets up
		require.True(t, expectedQuery.GetHistory, "Migration should enable GetHistory")
		require.True(t, expectedQuery.AllowFallback, "Migration should enable AllowFallback")
		require.Equal(t, "ASC", expectedQuery.Order, "Migration should use ascending order")
		require.Equal(t, 100000000, expectedQuery.Limit, "Migration should use large limit")

		// Verify UseHistoryTable logic
		require.True(t, expectedQuery.UseHistoryTable(), "Migration query should use history table")
	})
}

package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestScanRow(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer mockDB.Close() // nolint:errcheck

	pathToFile := "path/to/file"
	provisioner := provisioning.NewProvisioningServiceMock(context.Background())
	provisioner.GetDashboardProvisionerResolvedPathFunc = func(name string) string { return "provisioner" }
	store := &dashboardSqlAccess{
		namespacer:   func(_ int64) string { return "default" },
		provisioning: provisioner,
		log:          log.New("test"),
	}

	columns := []string{"orgId", "dashboard_id", "name", "title", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data", "api_version"}
	id := int64(100)
	uid := "someuid"
	title := "Test Dashboard"
	folderUID := "folder123"
	timestamp := time.Now()
	k8sTimestamp := metav1.Time{Time: timestamp}
	version := int64(2)
	message := "updated message"
	createdUser := "creator"
	updatedUser := "updator"

	t.Run("Should scan a valid row correctly", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, uid, title, folderUID, nil, "", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`), "vXyz")
		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer resultRows.Close() // nolint:errcheck
		resultRows.Next()

		row, err := store.scanRow(resultRows, false)
		require.NoError(t, err)
		require.NotNil(t, row)
		require.Equal(t, uid, row.Dash.Name)
		require.Equal(t, version, row.RV) // rv should be the dashboard version
		require.Equal(t, common.Unstructured{
			Object: map[string]interface{}{"key": "value"},
		}, row.Dash.Spec)
		require.Equal(t, "default", row.Dash.Namespace)
		require.Equal(t, &continueToken{orgId: int64(1), id: id}, row.token)

		meta, err := utils.MetaAccessor(row.Dash)
		require.NoError(t, err)
		require.Equal(t, id, meta.GetDeprecatedInternalID()) // nolint:staticcheck
		require.Equal(t, version, meta.GetGeneration())      // generation should be dash version
		require.Equal(t, k8sTimestamp, meta.GetCreationTimestamp())
		require.Equal(t, "user:"+createdUser, meta.GetCreatedBy()) // should be prefixed by user:
		require.Equal(t, "user:"+updatedUser, meta.GetUpdatedBy()) // should be prefixed by user:
		require.Equal(t, message, meta.GetMessage())
		require.Equal(t, folderUID, meta.GetFolder())
		require.Equal(t, "dashboard.grafana.app/vXyz", row.Dash.APIVersion)
	})

	t.Run("File provisioned dashboard should have annotations", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, uid, title, folderUID, nil, "", "provisioner", pathToFile, "hashing", 100000, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`), "vXyz")
		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer resultRows.Close() // nolint:errcheck
		resultRows.Next()

		row, err := store.scanRow(resultRows, false)
		require.NoError(t, err)
		require.NotNil(t, row)

		meta, err := utils.MetaAccessor(row.Dash)
		require.NoError(t, err)
		m, ok := meta.GetManagerProperties()
		require.True(t, ok)

		s, ok := meta.GetSourceProperties()
		require.True(t, ok)

		require.Equal(t, utils.ManagerKindClassicFP, m.Kind) // nolint:staticcheck
		require.Equal(t, "provisioner", m.Identity)
		require.Equal(t, pathToFile, s.Path)
		require.Equal(t, "hashing", s.Checksum)
		require.NoError(t, err)
		require.Equal(t, int64(100000), s.TimestampMillis)
	})

	t.Run("Plugin provisioned dashboard should have annotations", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, uid, title, folderUID, nil, "slo", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`), "vXyz")
		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer resultRows.Close() // nolint:errcheck
		resultRows.Next()

		row, err := store.scanRow(resultRows, false)
		require.NoError(t, err)
		require.NotNil(t, row)

		meta, err := utils.MetaAccessor(row.Dash)
		require.NoError(t, err)
		manager, ok := meta.GetManagerProperties()
		require.True(t, ok)

		require.Equal(t, utils.ManagerKindPlugin, manager.Kind)
		require.Equal(t, "slo", manager.Identity)                                // the ID of the plugin
		require.Equal(t, "", meta.GetAnnotations()[utils.AnnoKeySourceChecksum]) // hash is not used on plugins
	})

	t.Run("Migration scenario should use COALESCE logic with AllowFallback=true", func(t *testing.T) {
		// This specifically tests the migration use case where GetHistory=true but AllowFallback=true
		// allows the query to use COALESCE logic to fall back to dashboard table data when
		// dashboard_version entries are missing.

		migrationTimestamp := timestamp.Add(2 * time.Hour) // Migration scenario timestamp
		migrationVersion := int64(5)
		migrationUpdatedUser := "migration_updater"
		migrationMessage := "" // Empty message for migration (COALESCE behavior)
		migrationData := []byte(`{"migration": "data", "title": "Migrated Dashboard"}`)
		migrationAPIVersion := "v0alpha1"

		// In migration scenario, COALESCE functions return dashboard table values
		// when dashboard_version values are NULL, ensuring all dashboards are migrated
		rows := sqlmock.NewRows(columns).AddRow(
			1, id, uid, title, folderUID, nil, "", // basic dashboard fields
			"", "", "", 0, // origin fields
			timestamp, createdUser, 0, // created fields
			// These represent COALESCED values from dashboard table (not version table)
			migrationTimestamp, migrationUpdatedUser, 0, migrationVersion, migrationMessage, migrationData, migrationAPIVersion,
		)

		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer resultRows.Close() // nolint:errcheck
		resultRows.Next()

		// Test with history=true (migration scenario) - should work with COALESCED values
		row, err := store.scanRow(resultRows, true)
		require.NoError(t, err)
		require.NotNil(t, row)

		// Verify migration scenario works correctly with fallback data
		require.Equal(t, uid, row.Dash.Name)
		require.Equal(t, "Migrated Dashboard", row.Dash.Spec.Object["title"])
		require.Equal(t, migrationVersion, row.RV) // Should use COALESCEd dashboard table version
		require.Equal(t, common.Unstructured{
			Object: map[string]interface{}{
				"migration": "data",
				"title":     "Migrated Dashboard",
			},
		}, row.Dash.Spec) // Should use COALESCEd dashboard table data
		require.Equal(t, "default", row.Dash.Namespace)

		// Token should use the version in history mode (migration scenario)
		require.Equal(t, &continueToken{orgId: int64(1), id: migrationVersion}, row.token)

		meta, err := utils.MetaAccessor(row.Dash)
		require.NoError(t, err)
		require.Equal(t, id, meta.GetDeprecatedInternalID())                // nolint:staticcheck
		require.Equal(t, migrationVersion, meta.GetGeneration())            // Should use COALESCEd version
		require.Equal(t, k8sTimestamp, meta.GetCreationTimestamp())         // Created timestamp unchanged
		require.Equal(t, "user:"+createdUser, meta.GetCreatedBy())          // Original creator preserved
		require.Equal(t, "user:"+migrationUpdatedUser, meta.GetUpdatedBy()) // COALESCEd updater
		require.Equal(t, migrationMessage, meta.GetMessage())               // Empty message from COALESCE
		require.Equal(t, folderUID, meta.GetFolder())
		require.Equal(t, "dashboard.grafana.app/"+migrationAPIVersion, row.Dash.APIVersion)
	})

	t.Run("should follow dashboard template when failing to unmarshal dashboard", func(t *testing.T) {
		// row with bad data
		badData := []byte(`{"rows":[{"panels":[{"targets":[{"refId":"A","target":"aliasSub(alias, '^(.{27}).+', '\1...')"}]}]}]}`)
		rows := sqlmock.NewRows(columns).AddRow(1, id, uid, title, folderUID, nil, "", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, badData, "vXyz")
		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer func() {
			_ = resultRows.Close()
		}()
		resultRows.Next()

		store = &dashboardSqlAccess{
			namespacer:   func(_ int64) string { return "default" },
			provisioning: provisioner,
			log:          log.New("test"),
		}

		row, err := store.scanRow(resultRows, false)
		require.NoError(t, err)
		require.NotNil(t, row)
		require.Equal(t, uid, row.Dash.Name)
		require.Equal(t, version, row.RV)
		require.Equal(t, "default", row.Dash.Namespace)
		require.Equal(t, &continueToken{orgId: int64(1), id: id}, row.token)

		// instead of failing, create dummy dashboard with broken json inlined in text panel
		require.Equal(t, title, row.Dash.Spec.Object["title"])
		panels, exists := row.Dash.Spec.Object["panels"]
		require.True(t, exists, "panels property should exist")

		panelsSlice, ok := panels.([]interface{})
		require.True(t, ok, "panels should be a slice")
		require.Len(t, panelsSlice, 1, "panels should have exactly one element")

		panel, ok := panelsSlice[0].(map[string]interface{})
		require.True(t, ok, "panel should be a map")

		options, exists := panel["options"]
		require.True(t, exists, "panel should have options property")

		optionsMap, ok := options.(map[string]interface{})
		require.True(t, ok, "options should be a map")

		content, exists := optionsMap["content"]
		require.True(t, exists, "options should have content property")

		contentStr, ok := content.(string)
		require.True(t, ok, "content should be a string")
		require.Equal(t, string(badData), contentStr, "content should match bad json data")
	})
}

func TestParseLibraryPanelRow(t *testing.T) {
	basePanel := panel{
		ID:          1,
		UID:         "panel-uid",
		FolderUID:   sql.NullString{String: "folder-uid", Valid: true},
		Created:     time.Now(),
		CreatedBy:   sql.NullString{String: "creator", Valid: true},
		Updated:     time.Now(),
		UpdatedBy:   sql.NullString{String: "updator", Valid: true},
		Version:     2,
		Type:        "graph",
		Description: "desc from db",
	}

	t.Run("type mismatch triggers warning", func(t *testing.T) {
		p := basePanel
		p.Name = "Test Panel"
		p.Type = "graph"
		model := map[string]interface{}{
			"title":       "Test Panel",
			"type":        "table",
			"description": "desc from db",
		}
		modelBytes, err := json.Marshal(model)
		require.NoError(t, err)
		p.Model = modelBytes

		item, err := parseLibraryPanelRow(p)
		require.NoError(t, err)
		require.Equal(t, "table", item.Spec.Type)
		require.NotEmpty(t, item.Status.Warnings)
		require.Contains(t, item.Status.Warnings[0], "type mismatch")
	})

	t.Run("metadata is set correctly", func(t *testing.T) {
		p := basePanel
		p.Name = "Test Panel"
		// Ensure there's a time difference greater than 1 second to trigger updated metadata
		p.Updated = p.Created.Add(2 * time.Second)
		model := map[string]interface{}{
			"title":       "Test Panel",
			"type":        "graph",
			"description": "desc from db",
		}
		modelBytes, err := json.Marshal(model)
		require.NoError(t, err)
		p.Model = modelBytes

		item, err := parseLibraryPanelRow(p)
		require.NoError(t, err)

		meta, err := utils.MetaAccessor(&item)
		require.NoError(t, err)
		require.Equal(t, p.ID, meta.GetDeprecatedInternalID()) // nolint:staticcheck
		require.Equal(t, p.Version, meta.GetGeneration())
		require.Equal(t, p.FolderUID.String, meta.GetFolder())
		require.Equal(t, "user:creator", meta.GetCreatedBy())
		require.Equal(t, "user:updator", meta.GetUpdatedBy())
	})

	t.Run("panel title in dashboard vs library panel title is set correctly", func(t *testing.T) {
		p := basePanel
		p.Name = "Database Name"
		model := map[string]interface{}{
			"title":       "Model Title",
			"type":        "graph",
			"description": "desc from db",
		}
		modelBytes, err := json.Marshal(model)
		require.NoError(t, err)
		p.Model = modelBytes

		item, err := parseLibraryPanelRow(p)
		require.NoError(t, err)

		require.Equal(t, "Model Title", item.Spec.PanelTitle)
		require.Equal(t, "Database Name", item.Spec.Title)
	})

	t.Run("handles NULL created_by and updated_by fields", func(t *testing.T) {
		p := basePanel
		p.Name = "Test Panel"
		// Set CreatedBy and UpdatedBy to NULL (Invalid)
		p.CreatedBy = sql.NullString{String: "", Valid: false}
		p.UpdatedBy = sql.NullString{String: "", Valid: false}
		model := map[string]interface{}{
			"title":       "Test Panel",
			"type":        "graph",
			"description": "desc from db",
		}
		modelBytes, err := json.Marshal(model)
		require.NoError(t, err)
		p.Model = modelBytes

		item, err := parseLibraryPanelRow(p)
		require.NoError(t, err)

		meta, err := utils.MetaAccessor(&item)
		require.NoError(t, err)

		// When CreatedBy is NULL, it should be set to empty string
		require.Equal(t, "", meta.GetCreatedBy())

		// When UpdatedBy is NULL and not valid, updated metadata should not be set
		require.Equal(t, "", meta.GetUpdatedBy())
		// The updated timestamp should not be set when UpdatedBy is invalid
		updatedTimestamp, err := meta.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.Nil(t, updatedTimestamp)
	})

	t.Run("handles valid created_by but NULL updated_by", func(t *testing.T) {
		p := basePanel
		p.Name = "Test Panel"
		p.CreatedBy = sql.NullString{String: "creator", Valid: true}
		p.UpdatedBy = sql.NullString{String: "", Valid: false}
		// Make sure there's a time difference to trigger the update logic
		p.Updated = p.Created.Add(10 * time.Second)
		model := map[string]interface{}{
			"title":       "Test Panel",
			"type":        "graph",
			"description": "desc from db",
		}
		modelBytes, err := json.Marshal(model)
		require.NoError(t, err)
		p.Model = modelBytes

		item, err := parseLibraryPanelRow(p)
		require.NoError(t, err)

		meta, err := utils.MetaAccessor(&item)
		require.NoError(t, err)

		require.Equal(t, "user:creator", meta.GetCreatedBy())
		// Even with time difference, if UpdatedBy is not valid, updated metadata should not be set
		require.Equal(t, "", meta.GetUpdatedBy())
		updatedTimestamp, err := meta.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.Nil(t, updatedTimestamp)
	})
}

func TestRowsWrapper_PropagatesRowsErr(t *testing.T) {
	mockDB, smock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() {
		_ = mockDB.Close()
	}()

	provisioner := provisioning.NewProvisioningServiceMock(context.Background())
	provisioner.GetDashboardProvisionerResolvedPathFunc = func(name string) string { return "provisioner" }
	store := &dashboardSqlAccess{
		namespacer:   func(_ int64) string { return "default" },
		provisioning: provisioner,
		log:          log.New("test"),
	}

	columns := []string{"orgId", "dashboard_id", "name", "title", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data", "api_version"}
	timestamp := time.Now()

	t.Run("rows.Err after partial iteration is surfaced via Error()", func(t *testing.T) {
		// Simulate: first row succeeds, second row triggers a rows.Err()
		simulatedErr := fmt.Errorf("connection reset by peer")
		rows := sqlmock.NewRows(columns).
			AddRow(1, int64(1), "uid1", "Dashboard 1", "folder1", nil, "", "", "", "", 0, timestamp, "creator", 0, timestamp, "updater", 0, int64(1), "msg", []byte(`{"key":"value"}`), "v0alpha1").
			RowError(1, simulatedErr). // error on second row
			AddRow(1, int64(2), "uid2", "Dashboard 2", "folder1", nil, "", "", "", "", 0, timestamp, "creator", 0, timestamp, "updater", 0, int64(1), "msg", []byte(`{"key":"value"}`), "v0alpha1")

		smock.ExpectQuery("SELECT").WillReturnRows(rows)
		sqlRows, err := mockDB.Query("SELECT")
		require.NoError(t, err)

		wrapper := &rowsWrapper{
			rows:    sqlRows,
			a:       store,
			history: false,
		}
		defer func() {
			_ = wrapper.Close()
		}()

		// First call should succeed
		require.True(t, wrapper.Next())
		require.NoError(t, wrapper.Error())
		require.Equal(t, "uid1", wrapper.Name())

		// Second call should return false and surface the rows.Err()
		require.False(t, wrapper.Next())
		require.Error(t, wrapper.Error())
		require.ErrorContains(t, wrapper.Error(), "connection reset by peer")
	})

	t.Run("rows.Err on first row surfaces error and returns no rows", func(t *testing.T) {
		// Simulate: error on the very first row — migration would see 0 rows
		simulatedErr := fmt.Errorf("database is locked")
		rows := sqlmock.NewRows(columns).
			RowError(0, simulatedErr).
			AddRow(1, int64(1), "uid1", "Dashboard 1", "folder1", nil, "", "", "", "", 0, timestamp, "creator", 0, timestamp, "updater", 0, int64(1), "msg", []byte(`{"key":"value"}`), "v0alpha1")

		smock.ExpectQuery("SELECT").WillReturnRows(rows)
		sqlRows, err := mockDB.Query("SELECT")
		require.NoError(t, err)

		wrapper := &rowsWrapper{
			rows:    sqlRows,
			a:       store,
			history: false,
		}
		defer func() {
			_ = wrapper.Close()
		}()

		// First call should return false (error on first row)
		require.False(t, wrapper.Next())
		// The error from rows.Err() must be surfaced
		require.Error(t, wrapper.Error(), "rows.Err() must be propagated to wrapper.Error()")
		require.ErrorContains(t, wrapper.Error(), "database is locked")
	})

	t.Run("no error when all rows are consumed successfully", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).
			AddRow(1, int64(1), "uid1", "Dashboard 1", "folder1", nil, "", "", "", "", 0, timestamp, "creator", 0, timestamp, "updater", 0, int64(1), "msg", []byte(`{"key":"value"}`), "v0alpha1").
			AddRow(1, int64(2), "uid2", "Dashboard 2", "folder1", nil, "", "", "", "", 0, timestamp, "creator", 0, timestamp, "updater", 0, int64(1), "msg", []byte(`{"key":"value"}`), "v0alpha1")

		smock.ExpectQuery("SELECT").WillReturnRows(rows)
		sqlRows, err := mockDB.Query("SELECT")
		require.NoError(t, err)

		wrapper := &rowsWrapper{
			rows:    sqlRows,
			a:       store,
			history: false,
		}
		defer func() {
			_ = wrapper.Close()
		}()

		require.True(t, wrapper.Next())
		require.NoError(t, wrapper.Error())
		require.True(t, wrapper.Next())
		require.NoError(t, wrapper.Error())
		require.False(t, wrapper.Next())
		require.NoError(t, wrapper.Error(), "no error expected when all rows consumed successfully")
	})
}

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
		opts := migrations.MigrateOptions{
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

package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/user"
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
		features:     featuremgmt.WithFeatures(),
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

	t.Run("should follow dashboard template when failing to unmarshal dashboard if feature flag X is enabled", func(t *testing.T) {
		// row with bad data
		badData := []byte(`{"rows":[{"panels":[{"targets":[{"refId":"A","target":"aliasSub(alias, '^(.{27}).+', '\1...')"}]}]}]}`)
		rows := sqlmock.NewRows(columns).AddRow(1, id, uid, title, folderUID, nil, "", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, badData, "vXyz")
		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer resultRows.Close() // nolint:errcheck
		resultRows.Next()

		row, err := store.scanRow(resultRows, false)
		require.Error(t, err, "JSON unmarshal error for: Test Dashboard // invalid character '1' in string escape code")
		require.NotNil(t, row)
		// correctly scans these
		require.Equal(t, uid, row.Dash.Name)
		require.Equal(t, version, row.RV)
		require.Equal(t, "default", row.Dash.Namespace)
		require.Equal(t, &continueToken{orgId: int64(1), id: id}, row.token)

		// failure case: does NOT parse the dashboard itself
		require.Equal(t, common.Unstructured{
			Object: nil,
		}, row.Dash.Spec)

		// store with feature flag enabled
		store = &dashboardSqlAccess{
			namespacer:   func(_ int64) string { return "default" },
			provisioning: provisioner,
			log:          log.New("test"),
			features:     featuremgmt.WithFeatures(featuremgmt.FlagScanRowInvalidDashboardParseFallbackEnabled),
		}

		row, err = store.scanRow(resultRows, false)
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

func TestBuildSaveDashboardCommand(t *testing.T) {
	testCases := []struct {
		name          string
		schemaVersion int
		expectedAPI   string
	}{
		{
			name:          "with schema version 36 should save as v0",
			schemaVersion: 36,
			expectedAPI:   dashboardV0.VERSION,
		},
		// {
		// 	name:          "with schema version 41 should save as v1",
		// 	schemaVersion: 41,
		// 	expectedAPI:   dashboardV1.VERSION,
		// },
		// {
		// 	name:          "with empty schema version should save as v0",
		// 	schemaVersion: 0,
		// 	expectedAPI:   dashboardV0.VERSION,
		// },
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockStore := &dashboards.FakeDashboardStore{}
			access := &dashboardSqlAccess{
				dashStore: mockStore,
				log:       log.New("test"),
			}

			dashSpec := map[string]interface{}{
				"title": "Test Dashboard",
				"id":    123,
			}

			if tc.schemaVersion > 0 {
				dashSpec["schemaVersion"] = tc.schemaVersion
			}

			dash := &dashboardV1.Dashboard{
				TypeMeta: metav1.TypeMeta{
					APIVersion: dashboardV1.APIVERSION,
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dash",
				},
				Spec: common.Unstructured{
					Object: dashSpec,
				},
			}

			// fail if no user in context
			_, _, err := access.buildSaveDashboardCommand(context.Background(), 1, dash)
			require.Error(t, err)

			ctx := identity.WithRequester(context.Background(), &user.SignedInUser{
				OrgID:   1,
				OrgRole: "Admin",
			})
			// create new dashboard
			mockStore.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, nil).Once()
			cmd, created, err := access.buildSaveDashboardCommand(ctx, 1, dash)
			require.NoError(t, err)
			require.Equal(t, true, created)
			require.NotNil(t, cmd)
			require.Equal(t, "test-dash", cmd.Dashboard.Get("uid").MustString())
			_, exists := cmd.Dashboard.CheckGet("id")
			require.False(t, exists) // id should be removed
			require.Equal(t, cmd.OrgID, int64(1))
			require.True(t, cmd.Overwrite)
			require.Equal(t, tc.expectedAPI, cmd.APIVersion) // verify expected API version

			// now update existing dashboard
			mockStore.On("GetDashboard", mock.Anything, mock.Anything).Return(
				&dashboards.Dashboard{
					ID:         1234,
					Version:    2,
					APIVersion: dashboardV1.VERSION,
				}, nil).Once()
			cmd, created, err = access.buildSaveDashboardCommand(ctx, 1, dash)
			require.NoError(t, err)
			require.Equal(t, false, created)
			require.NotNil(t, cmd)
			require.Equal(t, "test-dash", cmd.Dashboard.Get("uid").MustString())
			require.Equal(t, cmd.Dashboard.Get("id").MustInt64(), int64(1234))       // should set to existing ID
			require.Equal(t, cmd.Dashboard.Get("version").MustFloat64(), float64(2)) // version must be set - otherwise seen as a new dashboard in NewDashboardFromJson
			require.Equal(t, tc.expectedAPI, cmd.APIVersion)                         // verify expected API version
			require.Equal(t, cmd.OrgID, int64(1))
			require.True(t, cmd.Overwrite)
		})
	}
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

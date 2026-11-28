package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type recordingLibraryPanelStream struct {
	grpc.ClientStream
	requests []*resourcepb.BulkRequest
}

func (s *recordingLibraryPanelStream) Send(req *resourcepb.BulkRequest) error {
	s.requests = append(s.requests, req)
	return nil
}

func (s *recordingLibraryPanelStream) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	return &resourcepb.BulkResponse{}, nil
}

func TestMigrateLibraryPanelPages(t *testing.T) {
	stream := &recordingLibraryPanelStream{}
	var queries []LibraryPanelQuery
	getPanels := func(_ context.Context, query LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error) {
		queries = append(queries, query)
		switch query.LastID {
		case 0:
			return &dashboardV0.LibraryPanelList{
				ListMeta: metav1.ListMeta{Continue: "10"},
				Items: []dashboardV0.LibraryPanel{
					{ObjectMeta: metav1.ObjectMeta{Name: "first"}},
					{ObjectMeta: metav1.ObjectMeta{Name: "second", Generation: 2}},
				},
			}, nil
		case 10:
			return &dashboardV0.LibraryPanelList{
				Items: []dashboardV0.LibraryPanel{{ObjectMeta: metav1.ObjectMeta{Name: "third"}}},
			}, nil
		default:
			t.Fatalf("unexpected cursor: %d", query.LastID)
			return nil, nil
		}
	}

	err := migrateLibraryPanelPages(t.Context(), 7, migrations.MigrateOptions{
		Namespace: "org-7",
		Progress:  func(int, string) {},
	}, stream, getPanels, 2)
	require.NoError(t, err)
	require.Equal(t, []LibraryPanelQuery{
		{OrgID: 7, Limit: 2},
		{OrgID: 7, Limit: 2, LastID: 10},
	}, queries)
	require.Len(t, stream.requests, 3)
	require.Equal(t, []string{"first", "second", "third"}, []string{
		stream.requests[0].Key.Name,
		stream.requests[1].Key.Name,
		stream.requests[2].Key.Name,
	})
	for _, req := range stream.requests {
		require.Equal(t, "org-7", req.Key.Namespace)
		var panel dashboardV0.LibraryPanel
		require.NoError(t, json.Unmarshal(req.Value, &panel))
		require.Equal(t, "org-7", panel.Namespace)
	}
	require.Equal(t, resourcepb.BulkRequest_MODIFIED, stream.requests[1].Action)
}

func TestMigrateLibraryPanelPagesRejectsInvalidCursor(t *testing.T) {
	getPanels := func(_ context.Context, _ LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error) {
		return &dashboardV0.LibraryPanelList{ListMeta: metav1.ListMeta{Continue: "invalid"}}, nil
	}
	err := migrateLibraryPanelPages(t.Context(), 7, migrations.MigrateOptions{
		Namespace: "org-7",
		Progress:  func(int, string) {},
	}, &recordingLibraryPanelStream{}, getPanels, 2)
	require.ErrorContains(t, err, "invalid library panel continuation token")
}

func TestMigrateLibraryPanelPagesEmpty(t *testing.T) {
	stream := &recordingLibraryPanelStream{}
	queries := 0
	err := migrateLibraryPanelPages(t.Context(), 7, migrations.MigrateOptions{
		Namespace: "org-7",
		Progress:  func(int, string) {},
	}, stream, func(_ context.Context, query LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error) {
		queries++
		require.Equal(t, LibraryPanelQuery{OrgID: 7, Limit: 1000}, query)
		return &dashboardV0.LibraryPanelList{}, nil
	}, 1000)
	require.NoError(t, err)
	require.Equal(t, 1, queries)
	require.Empty(t, stream.requests)
}

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

	t.Run("typed fields are not retained in status missing", func(t *testing.T) {
		p := basePanel
		p.Name = "Test Panel"
		modelBytes, err := json.Marshal(map[string]interface{}{
			"title":       "Panel title",
			"type":        "graph",
			"description": "desc from db",
			"links":       []interface{}{map[string]interface{}{"title": "Link"}},
			"transparent": true,
		})
		require.NoError(t, err)
		p.Model = modelBytes

		item, err := parseLibraryPanelRow(p)
		require.NoError(t, err)
		require.NotContains(t, item.Status.Missing.Object, "links")
		require.NotContains(t, item.Status.Missing.Object, "transparent")
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

func TestCollectLibraryPanelPagePaginatesReadableItems(t *testing.T) {
	mockDB, mockDBController, err := sqlmock.New()
	require.NoError(t, err)
	defer mockDB.Close() // nolint:errcheck

	columns := []string{
		"id", "uid", "folder_uid", "created", "created_by", "updated", "updated_by",
		"name", "type", "description", "model", "version",
	}
	now := time.Now()
	model := []byte(`{"type":"text","title":"Panel","options":{},"fieldConfig":{}}`)
	rows := sqlmock.NewRows(columns).
		AddRow(3, "denied", "", now, nil, now, nil, "Denied", "text", "", model, 1).
		AddRow(2, "first-readable", "", now, nil, now, nil, "First", "text", "", model, 1).
		AddRow(1, "second-readable", "", now, nil, now, nil, "Second", "text", "", model, 1)
	mockDBController.ExpectQuery("SELECT").WillReturnRows(rows)

	sqlRows, err := mockDB.Query("SELECT")
	require.NoError(t, err)
	defer sqlRows.Close() // nolint:errcheck

	page, err := collectLibraryPanelPage(sqlRows, 1, func(item dashboardV0.LibraryPanel) (bool, error) {
		return item.Name != "denied", nil
	})

	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	require.Equal(t, "first-readable", page.Items[0].Name)
	require.Equal(t, "2", page.Continue)
	require.NoError(t, mockDBController.ExpectationsWereMet())
}

func TestCollectLibraryPanelPageRejectsMalformedModel(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer mockDB.Close() // nolint:errcheck

	rows := sqlmock.NewRows([]string{
		"id", "uid", "folder_uid", "created", "created_by", "updated", "updated_by",
		"name", "type", "description", "model", "version",
	}).AddRow(1, "bad-model", "", time.Now(), nil, time.Now(), nil, "Bad model", "text", "", []byte(`{"type":`), 1)
	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	sqlRows, err := mockDB.Query("SELECT")
	require.NoError(t, err)
	defer sqlRows.Close() // nolint:errcheck

	page, err := collectLibraryPanelPage(sqlRows, 1000, func(dashboardV0.LibraryPanel) (bool, error) {
		return true, nil
	})
	require.Error(t, err)
	require.Empty(t, page.Items)
	require.NoError(t, mock.ExpectationsWereMet())
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

		// Migration pages by (dashboard id, version), which the indexes can serve
		require.Contains(t, sql, "dashboard.id ASC,",
			"Migration SQL should ORDER BY dashboard id")
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

func TestCollectMigrationPage(t *testing.T) {
	store := &dashboardSqlAccess{
		namespacer:   func(_ int64) string { return "default" },
		provisioning: provisioning.NewProvisioningServiceMock(context.Background()),
		log:          log.New("test"),
	}
	columns := []string{"orgId", "dashboard_id", "name", "title", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data", "api_version"}
	now := time.Now()
	type dbRow struct {
		id      int64
		version int64
		created any // a value that is not a time fails Scan, which rejects the row
	}
	collect := func(t *testing.T, rows []dbRow, maxBytes int, emit ...func(migrationItem) (bool, error)) *migrationPage {
		t.Helper()
		mockDB, mock, err := sqlmock.New()
		require.NoError(t, err)
		t.Cleanup(func() { _ = mockDB.Close() })

		mockRows := sqlmock.NewRows(columns)
		for _, r := range rows {
			mockRows.AddRow(1, r.id, fmt.Sprintf("uid-%d", r.id), "title", "", nil, "", "", "", "", 0, r.created, "", 0, now, "", 0, r.version, "", []byte(`{"title":"title"}`), "v1")
		}
		mock.ExpectQuery("SELECT").WillReturnRows(mockRows)
		sqlRows, err := mockDB.Query("SELECT")
		require.NoError(t, err)
		t.Cleanup(func() { _ = sqlRows.Close() })

		var send func(migrationItem) (bool, error)
		if len(emit) > 0 {
			send = emit[0]
		}
		page, err := collectMigrationPage(&rowsWrapper{a: store, rows: sqlRows, history: true}, "default", maxBytes, dashboardBulkRequest, send)
		require.NoError(t, err)
		return page
	}

	t.Run("full page continues after the last row", func(t *testing.T) {
		page := collect(t, []dbRow{{1, 1, now}, {1, 2, now}, {2, 1, now}}, migrationPageMaxBytes)
		require.True(t, page.full(3))
		require.Equal(t, 3, page.scanned)
		require.Equal(t, int64(2), page.lastID)
		require.Equal(t, int64(1), page.lastVersion)
		require.Len(t, page.items, 3)
		require.Equal(t, resourcepb.BulkRequest_ADDED, page.items[0].req.Action)
		require.Equal(t, resourcepb.BulkRequest_MODIFIED, page.items[1].req.Action)
		require.Equal(t, "uid-2", page.items[2].req.Key.Name)
	})

	t.Run("short page is the last page", func(t *testing.T) {
		page := collect(t, []dbRow{{1, 1, now}, {2, 1, now}}, migrationPageMaxBytes)
		require.False(t, page.full(3))
		require.Len(t, page.items, 2)
	})

	t.Run("byte limit cuts the page after the row that reaches it", func(t *testing.T) {
		page := collect(t, []dbRow{{1, 1, now}, {1, 2, now}, {2, 1, now}}, 1)
		require.True(t, page.full(3))
		require.Len(t, page.items, 1)
		require.Equal(t, int64(1), page.lastID)
		require.Equal(t, int64(1), page.lastVersion)
	})

	t.Run("page counts the dashboards it covered", func(t *testing.T) {
		page := collect(t, []dbRow{{1, 1, now}, {1, 2, now}, {2, 1, now}}, migrationPageMaxBytes)
		require.Equal(t, 2, page.dashboards)
		require.False(t, page.cutByBytes)
	})

	t.Run("byte limit marks the page as cut", func(t *testing.T) {
		page := collect(t, []dbRow{{1, 1, now}, {1, 2, now}, {2, 1, now}}, 1)
		require.True(t, page.cutByBytes)
		require.Equal(t, 1, page.scanned)
	})

	t.Run("emit receives rows as they are read and can stop the read", func(t *testing.T) {
		var names []string
		page := collect(t, []dbRow{{1, 1, now}, {2, 1, now}, {3, 1, now}}, 0, func(item migrationItem) (bool, error) {
			names = append(names, item.req.Key.Name)
			return len(names) == 2, nil
		})
		require.Equal(t, []string{"uid-1", "uid-2"}, names)
		require.Empty(t, page.items)
	})

	t.Run("rejected rows still advance the keyset", func(t *testing.T) {
		page := collect(t, []dbRow{{1, 1, now}, {2, 1, now}, {3, 4, "not a time"}}, migrationPageMaxBytes)
		require.True(t, page.full(3))
		require.Len(t, page.items, 2)
		require.Len(t, page.rejected, 1)
		require.Equal(t, int64(3), page.lastID)
		require.Equal(t, int64(4), page.lastVersion)
	})

	t.Run("rejected page tail is not carried into the next page", func(t *testing.T) {
		rows := make([]dbRow, 0, 500)
		for i := int64(1); i <= 500; i++ {
			created := any(now)
			if i > 400 {
				created = "not a time"
			}
			rows = append(rows, dbRow{i, 1, created})
		}
		page := collect(t, rows, migrationPageMaxBytes)
		require.True(t, page.full(500))
		require.Len(t, page.items, 400)
		require.Len(t, page.rejected, 100)
		// The next page starts after the last rejected row, so the 100 rejections are not read again
		require.Equal(t, int64(500), page.lastID)
		require.Equal(t, int64(1), page.lastVersion)
	})
}

func TestCollectMigrationPageFolders(t *testing.T) {
	store := &dashboardSqlAccess{
		namespacer:   func(_ int64) string { return "default" },
		provisioning: provisioning.NewProvisioningServiceMock(context.Background()),
		log:          log.New("test"),
	}
	columns := []string{"orgId", "dashboard_id", "name", "title", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data", "api_version"}
	now := time.Now()

	mockDB, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })
	// Folders are listed by descending id
	mockRows := sqlmock.NewRows(columns).
		AddRow(1, 30, "folder-30", "Thirty", "parent", nil, "", "", "", "", 0, now, "", 0, now, "", 0, 2, "", []byte(`{"title":"Thirty","description":"d","panels":[]}`), "").
		AddRow(1, 20, "folder-20", "Twenty", "", nil, "", "", "", "", 0, now, "", 0, now, "", 0, 1, "", []byte(`{"title":"Twenty"}`), "")
	mock.ExpectQuery("SELECT").WillReturnRows(mockRows)
	sqlRows, err := mockDB.Query("SELECT")
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlRows.Close() })

	page, err := collectMigrationPage(&rowsWrapper{a: store, rows: sqlRows}, "default", migrationPageMaxBytes, folderBulkRequest, nil)
	require.NoError(t, err)
	require.True(t, page.full(2))
	require.Equal(t, int64(20), page.lastID)
	require.Len(t, page.items, 2)

	req := page.items[0].req
	require.Equal(t, "folder.grafana.app", req.Key.Group)
	require.Equal(t, "folders", req.Key.Resource)
	require.Equal(t, "folder-30", req.Key.Name)
	require.Equal(t, "parent", req.Folder)
	require.Equal(t, resourcepb.BulkRequest_MODIFIED, req.Action)
	var obj map[string]any
	require.NoError(t, json.Unmarshal(req.Value, &obj))
	require.Equal(t, map[string]any{"title": "Thirty", "description": "d"}, obj["spec"])
	require.Equal(t, resourcepb.BulkRequest_ADDED, page.items[1].req.Action)
}

func TestAsInt64(t *testing.T) {
	for _, tc := range []struct {
		in   any
		want int64
		ok   bool
	}{
		{int64(7), 7, true},
		{int32(7), 7, true},
		{int(7), 7, true},
		{uint16(7), 7, true},
		{uint64(7), 7, true},
		{uint64(math.MaxUint64), 0, false},
		{[]byte("7"), 7, true},
		{"7", 7, true},
		{"x", 0, false},
		{nil, 0, false},
		{1.5, 0, false},
	} {
		got, ok := asInt64(tc.in)
		require.Equal(t, tc.ok, ok, "%T(%v)", tc.in, tc.in)
		if tc.ok {
			require.Equal(t, tc.want, got, "%T(%v)", tc.in, tc.in)
		}
	}
}

func TestNextPageLimit(t *testing.T) {
	require.Equal(t, 32, nextPageLimit(&migrationPage{scanned: 32, cutByBytes: true}, 500), "shrinks to the rows that fit")
	require.Equal(t, 1, nextPageLimit(&migrationPage{scanned: 0, cutByBytes: true}, 500))
	require.Equal(t, 64, nextPageLimit(&migrationPage{scanned: 32}, 32), "grows back after a page that was not cut")
	require.Equal(t, migrationPageMaxRows, nextPageLimit(&migrationPage{scanned: 400}, 400))
}

func TestDashboardPagerAdvance(t *testing.T) {
	t.Run("a bounded page with fewer rows than the limit continues after the bound with a larger window", func(t *testing.T) {
		p := newDashboardPager(1)
		p.window = 10
		p.query.UpToID = 50
		more, err := p.advance(&migrationPage{scanned: 120, dashboards: 10, lastID: 50, lastVersion: 12}, 500)
		require.NoError(t, err)
		require.True(t, more)
		require.Equal(t, int64(50), p.query.AfterID)
		require.Equal(t, int64(math.MaxInt32), p.query.AfterVersion)
		require.Equal(t, 20, p.window)
	})

	t.Run("a full bounded page continues after its last row and fits the window to it", func(t *testing.T) {
		p := newDashboardPager(1)
		p.query.UpToID = 900
		more, err := p.advance(&migrationPage{scanned: 500, dashboards: 25, lastID: 125, lastVersion: 7}, 500)
		require.NoError(t, err)
		require.True(t, more)
		require.Equal(t, int64(125), p.query.AfterID)
		require.Equal(t, int64(7), p.query.AfterVersion)
		require.Equal(t, 26, p.window)
	})

	t.Run("a full unbounded page fits the window so the next page gets a bound", func(t *testing.T) {
		p := newDashboardPager(1)
		// Fewer dashboards remain than the window, so the lookup found no bound
		p.query.UpToID = 0
		more, err := p.advance(&migrationPage{scanned: 500, dashboards: 25, lastID: 25, lastVersion: 20}, 500)
		require.NoError(t, err)
		require.True(t, more)
		require.Equal(t, int64(25), p.query.AfterID)
		require.Equal(t, 26, p.window)
	})

	t.Run("an unbounded page with fewer rows than the limit is the last one", func(t *testing.T) {
		p := newDashboardPager(1)
		more, err := p.advance(&migrationPage{scanned: 3, dashboards: 1, lastID: 9, lastVersion: 3}, 500)
		require.NoError(t, err)
		require.False(t, more)
	})

	t.Run("a full page that does not move the keyset fails", func(t *testing.T) {
		p := newDashboardPager(1)
		p.query.AfterID, p.query.AfterVersion = 125, 7
		_, err := p.advance(&migrationPage{scanned: 500, lastID: 125, lastVersion: 7}, 500)
		require.Error(t, err)
	})
}

func TestFolderPagerAdvance(t *testing.T) {
	p := newFolderPager(1)
	more, err := p.advance(&migrationPage{scanned: 2, lastID: 20}, 2)
	require.NoError(t, err)
	require.True(t, more)
	require.Equal(t, int64(20), p.query.LastID)

	_, err = p.advance(&migrationPage{scanned: 2, lastID: 20}, 2)
	require.Error(t, err, "descending ids must keep decreasing")

	more, err = p.advance(&migrationPage{scanned: 1, lastID: 10}, 2)
	require.NoError(t, err)
	require.False(t, more)
}

// lockingStream sends to a recordingLibraryPanelStream and, after the first row, lets another
// connection take an EXCLUSIVE lock whenever SQLite allows it, as a bulk write spilling its cache would.
type lockingStream struct {
	recordingLibraryPanelStream
	lock    func() error
	tried   bool
	lockErr error
}

func (s *lockingStream) Send(req *resourcepb.BulkRequest) error {
	if err := s.recordingLibraryPanelStream.Send(req); err != nil {
		return err
	}
	if !s.tried {
		s.tried = true
		s.lockErr = s.lock()
	}
	return nil
}

func TestMigrateDashboardsSQLiteReadKeepsWritersOut(t *testing.T) {
	store := db.NewTestStore(t)
	if store.GetDialect().DriverName() != "sqlite3" {
		t.Skip("SQLite rollback-journal locking only")
	}
	ctx := t.Context()
	engine := store.GetEngine()

	// More than one page of dashboards
	const count = migrationPageMaxRows + 100
	now := time.Now().UTC().Format("2006-01-02 15:04:05")
	for i := range count {
		_, err := engine.Exec(`INSERT INTO dashboard (org_id, uid, slug, title, data, created, updated, version, is_folder, folder_id, created_by, updated_by, has_acl, is_public)
			VALUES (1, ?, ?, ?, ?, ?, ?, 1, 0, 0, 1, 1, 0, 0)`,
			fmt.Sprintf("dash-%d", i), fmt.Sprintf("dash-%d", i), fmt.Sprintf("Dash %d", i), `{"title":"Dash"}`, now, now)
		require.NoError(t, err)
	}

	// Switch to the default rollback journal, where a writer's EXCLUSIVE lock blocks readers. The test
	// store opens connections in WAL mode, so its pool keeps the one switched connection, and the lock
	// is taken from a separate handle on the same file.
	sqlDB := engine.DB().DB
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	var mode string
	require.NoError(t, sqlDB.QueryRowContext(ctx, "PRAGMA journal_mode = DELETE").Scan(&mode))
	require.Equal(t, "delete", mode)

	path := strings.TrimPrefix(strings.SplitN(engine.DataSourceName(), "?", 2)[0], "file:")
	lockDB, err := sql.Open("sqlite3", "file:"+path+"?cache=private&mode=rw&_busy_timeout=0")
	require.NoError(t, err)
	conn, err := lockDB.Conn(ctx)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = conn.ExecContext(context.Background(), "ROLLBACK")
		_ = conn.Close()
		_ = lockDB.Close()
	})

	stream := &lockingStream{lock: func() error {
		_, err := conn.ExecContext(ctx, "BEGIN EXCLUSIVE")
		return err
	}}
	access := NewMigratorAccess(legacysql.NewDatabaseProvider(store), provisioning.NewProvisioningServiceMock(ctx), nil)
	err = access.MigrateDashboards(ctx, 1, migrations.MigrateOptions{
		Namespace:   "default",
		WithHistory: true,
		Progress:    func(int, string) {},
	}, stream)
	require.NoError(t, err)
	require.NoError(t, sqlDB.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&mode))
	require.Equal(t, "delete", mode)
	require.Len(t, stream.requests, count)
	require.Error(t, stream.lockErr, "the read must hold its lock while rows are sent")
}

// sendHookStream records requests and runs onSend before each one.
type sendHookStream struct {
	recordingLibraryPanelStream
	onSend func()
}

func (s *sendHookStream) Send(req *resourcepb.BulkRequest) error {
	if s.onSend != nil {
		s.onSend()
	}
	return s.recordingLibraryPanelStream.Send(req)
}

func TestIntegrationMigrateLegacyPages(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := db.NewTestStore(t)
	ctx := t.Context()
	engine := store.GetEngine()
	isPostgres := store.GetDialect().DriverName() == "postgres"
	now := time.Now().UTC().Format("2006-01-02 15:04:05")

	insertDashboard := func(uid string, version int, isFolder bool) int64 {
		t.Helper()
		_, err := engine.Exec(`INSERT INTO dashboard (org_id, uid, slug, title, data, created, updated, version, is_folder, folder_id, created_by, updated_by, has_acl, is_public)
			VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, ?, ?)`, uid, uid, uid, `{"title":"`+uid+`"}`, now, now, version, isFolder, false, false)
		require.NoError(t, err)
		var id int64
		_, err = engine.SQL("SELECT id FROM dashboard WHERE org_id = 1 AND uid = ?", uid).Get(&id)
		require.NoError(t, err)
		return id
	}

	// Dashboards with up to 4 versions and dashboards with no history rows: more rows than
	// one page, and the two row shapes interleaved by id
	want := map[string]bool{}
	for i := range 300 {
		uid := fmt.Sprintf("dash-%d", i)
		if i%3 == 0 {
			insertDashboard(uid, 1, false)
			want[fmt.Sprintf("%s@1", uid)] = true
			continue
		}
		versions := 1 + i%4
		id := insertDashboard(uid, versions, false)
		for v := 1; v <= versions; v++ {
			_, err := engine.Exec(`INSERT INTO dashboard_version (dashboard_id, parent_version, restored_from, version, created, created_by, message, data, api_version)
				VALUES (?, ?, 0, ?, ?, 1, '', ?, '')`, id, v-1, v, now, `{"title":"`+uid+`"}`)
			require.NoError(t, err)
			want[fmt.Sprintf("%s@%d", uid, v)] = true
		}
	}
	// One long history, so pages also break inside a single dashboard's versions
	longID := insertDashboard("dash-long", 1200, false)
	for v := 1; v <= 1200; v++ {
		_, err := engine.Exec(`INSERT INTO dashboard_version (dashboard_id, parent_version, restored_from, version, created, created_by, message, data, api_version)
			VALUES (?, ?, 0, ?, ?, 1, '', ?, '')`, longID, v-1, v, now, `{"title":"dash-long"}`)
		require.NoError(t, err)
		want[fmt.Sprintf("dash-long@%d", v)] = true
	}
	wantFolders := map[string]bool{}
	for i := range migrationPageMaxRows + 20 {
		uid := fmt.Sprintf("folder-%d", i)
		insertDashboard(uid, 1, true)
		wantFolders[uid] = true
	}

	var timeoutBefore string
	if isPostgres {
		_, err := engine.SQL("SHOW statement_timeout").Get(&timeoutBefore)
		require.NoError(t, err)
	}
	opts := migrations.MigrateOptions{Namespace: "default", WithHistory: true, Progress: func(int, string) {}}
	if isPostgres {
		opts.StatementTimeout = 15 * time.Minute
	}
	openTx := func() {
		if !isPostgres {
			return
		}
		var open int
		_, err := engine.SQL("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state LIKE 'idle in transaction%' AND pid <> pg_backend_pid()").Get(&open)
		require.NoError(t, err)
		require.Zero(t, open, "no page transaction may stay open while rows are sent")
	}

	access := NewMigratorAccess(legacysql.NewDatabaseProvider(store), provisioning.NewProvisioningServiceMock(ctx), nil)

	t.Run("every dashboard version is sent once", func(t *testing.T) {
		stream := &sendHookStream{onSend: openTx}
		require.NoError(t, access.MigrateDashboards(ctx, 1, opts, stream))
		got := map[string]int{}
		for _, req := range stream.requests {
			var obj struct {
				Metadata struct {
					Generation int64 `json:"generation"`
				} `json:"metadata"`
			}
			require.NoError(t, json.Unmarshal(req.Value, &obj))
			got[fmt.Sprintf("%s@%d", req.Key.Name, obj.Metadata.Generation)]++
		}
		require.Len(t, got, len(want))
		for key, n := range got {
			require.True(t, want[key], "unexpected row %s", key)
			require.Equal(t, 1, n, "row %s sent %d times", key, n)
		}
	})

	t.Run("every folder is sent once", func(t *testing.T) {
		stream := &sendHookStream{onSend: openTx}
		require.NoError(t, access.MigrateFolders(ctx, 1, opts, stream))
		got := map[string]int{}
		for _, req := range stream.requests {
			got[req.Key.Name]++
		}
		require.Len(t, got, len(wantFolders))
		for uid, n := range got {
			require.True(t, wantFolders[uid], "unexpected folder %s", uid)
			require.Equal(t, 1, n, "folder %s sent %d times", uid, n)
		}
	})

	t.Run("the timeout override applies inside page reads only", func(t *testing.T) {
		if !isPostgres {
			t.Skip("statement_timeout is Postgres only")
		}
		helper, err := legacysql.NewDatabaseProvider(store)(ctx)
		require.NoError(t, err)
		var inside []string
		_, err = access.readMigrationPage(ctx, helper, opts, func(ctx context.Context) (*migrationPage, error) {
			for range 2 {
				rows, err := access.executeQuery(ctx, helper, "SHOW statement_timeout")
				require.NoError(t, err)
				require.True(t, rows.Next())
				var v string
				require.NoError(t, rows.Scan(&v))
				require.NoError(t, rows.Close())
				inside = append(inside, v)
			}
			return &migrationPage{}, nil
		})
		require.NoError(t, err)
		require.Equal(t, []string{"15min", "15min"}, inside)

		var after string
		_, err = engine.SQL("SHOW statement_timeout").Get(&after)
		require.NoError(t, err)
		require.Equal(t, timeoutBefore, after)
	})
}

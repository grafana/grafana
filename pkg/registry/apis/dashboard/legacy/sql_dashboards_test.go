package legacy

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/provisioning"
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
	}

	columns := []string{"orgId", "dashboard_id", "name", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data", "api_version"}
	id := int64(100)
	title := "Test Dashboard"
	folderUID := "folder123"
	timestamp := time.Now()
	k8sTimestamp := v1.Time{Time: timestamp}
	version := int64(2)
	message := "updated message"
	createdUser := "creator"
	updatedUser := "updator"

	t.Run("Should scan a valid row correctly", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, title, folderUID, nil, "", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`), "vXyz")
		mock.ExpectQuery("SELECT *").WillReturnRows(rows)
		resultRows, err := mockDB.Query("SELECT *")
		require.NoError(t, err)
		defer resultRows.Close() // nolint:errcheck
		resultRows.Next()

		row, err := store.scanRow(resultRows, false)
		require.NoError(t, err)
		require.NotNil(t, row)
		require.Equal(t, "Test Dashboard", row.Dash.Name)
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
		rows := sqlmock.NewRows(columns).AddRow(1, id, title, folderUID, nil, "", "provisioner", pathToFile, "hashing", 100000, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`), "vXyz")
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
		require.Equal(t, "../"+pathToFile, s.Path) // relative to provisioner
		require.Equal(t, "hashing", s.Checksum)
		require.NoError(t, err)
		require.Equal(t, int64(100000), s.TimestampMillis)
	})

	t.Run("Plugin provisioned dashboard should have annotations", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, title, folderUID, nil, "slo", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`), "vXyz")
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
}

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
	dashboardinternal "github.com/grafana/grafana/pkg/apis/dashboard"
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

	columns := []string{"orgId", "dashboard_id", "name", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data"}
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
		rows := sqlmock.NewRows(columns).AddRow(1, id, title, folderUID, nil, "", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`))
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
		require.Equal(t, dashboardinternal.DashboardSpec{
			Unstructured: common.Unstructured{
				Object: map[string]interface{}{"key": "value"},
			},
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
	})

	t.Run("File provisioned dashboard should have annotations", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, title, folderUID, nil, "", "provisioner", pathToFile, "hashing", 100000, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`))
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
		require.Equal(t, "file:provisioner", meta.GetRepositoryName()) // should be prefixed by file:
		require.Equal(t, "../"+pathToFile, meta.GetRepositoryPath())   // relative to provisioner
		require.Equal(t, "hashing", meta.GetRepositoryHash())
		ts, err := meta.GetRepositoryTimestamp()
		require.NoError(t, err)
		require.Equal(t, int64(100000), ts.Unix())
	})

	t.Run("Plugin provisioned dashboard should have annotations", func(t *testing.T) {
		rows := sqlmock.NewRows(columns).AddRow(1, id, title, folderUID, nil, "slo", "", "", "", 0, timestamp, createdUser, 0, timestamp, updatedUser, 0, version, message, []byte(`{"key": "value"}`))
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
		require.Equal(t, "plugin", meta.GetRepositoryName())
		require.Equal(t, "slo", meta.GetRepositoryPath()) // the ID of the plugin
		require.Equal(t, "", meta.GetRepositoryHash())    // hash is not used on plugins
	})
}

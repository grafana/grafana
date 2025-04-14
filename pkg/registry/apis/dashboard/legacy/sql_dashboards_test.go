package legacy

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
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
	}

	columns := []string{"orgId", "dashboard_id", "name", "folder_uid", "deleted", "plugin_id", "origin_name", "origin_path", "origin_hash", "origin_ts", "created", "createdBy", "createdByID", "updated", "updatedBy", "updatedByID", "version", "message", "data", "api_version"}
	id := int64(100)
	title := "Test Dashboard"
	folderUID := "folder123"
	timestamp := time.Now()
	k8sTimestamp := metav1.Time{Time: timestamp}
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
		require.Equal(t, pathToFile, s.Path)
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

func TestBuildSaveDashboardCommand(t *testing.T) {
	testCases := []struct {
		name          string
		schemaVersion int
		expectedAPI   string
	}{
		{
			name:          "with schema version 36 should save as v0alpha1",
			schemaVersion: 36,
			expectedAPI:   "v0alpha1",
		},
		{
			name:          "with schema version 41 should save as v1alpha1",
			schemaVersion: 41,
			expectedAPI:   "v1alpha1",
		},
		{
			name:          "with empty schema version should save as v0alpha1",
			schemaVersion: 0,
			expectedAPI:   "v0alpha1",
		},
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

			dash := &dashboard.Dashboard{
				TypeMeta: metav1.TypeMeta{
					APIVersion: dashboard.APIVERSION,
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
					APIVersion: dashboard.APIVERSION,
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

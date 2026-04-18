package dashboards

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateDashboardJSON(t *testing.T) {
	lastModified := time.Now()
	folderID := int64(123)
	folderUID := "folder-uid-123"

	t.Run("orgID check", func(t *testing.T) {
		t.Run("matching is OK", func(t *testing.T) {
			cfg := &config{
				OrgID: 1,
			}

			dashboardJSON := simplejson.NewFromAny(map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":      "test-dashboard-uid",
					"namespace": "default",
				},
				"spec": map[string]interface{}{
					"title": "Test Dashboard",
				},
			})

			result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.Equal(t, "Test Dashboard", result.Dashboard.Title)
			assert.Equal(t, int64(1), result.OrgID)
			assert.Equal(t, int64(1), result.Dashboard.OrgID)
			assert.Equal(t, folderID, result.Dashboard.FolderID) // nolint:staticcheck
			assert.Equal(t, folderUID, result.Dashboard.FolderUID)
			assert.True(t, result.Overwrite)
			assert.Equal(t, lastModified, result.UpdatedAt)
		})

		t.Run("not set is OK", func(t *testing.T) {
			cfg := &config{
				OrgID: 1,
			}

			dashboardJSON := simplejson.NewFromAny(map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "test-dashboard-uid",
				},
				"spec": map[string]interface{}{
					"title": "Test Dashboard",
				},
			})

			result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.Equal(t, int64(1), result.OrgID)
			assert.Equal(t, int64(1), result.Dashboard.OrgID)
		})

		t.Run("not matching is an error", func(t *testing.T) {
			cfg := &config{
				OrgID: 1,
			}

			dashboardJSON := simplejson.NewFromAny(map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":      "test-dashboard-uid",
					"namespace": "org-123",
				},
				"spec": map[string]interface{}{
					"title": "Test Dashboard",
				},
			})

			result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

			require.Error(t, err)
			assert.Nil(t, result)
			assert.Contains(t, err.Error(), "dashboard orgID")
		})
	})

	t.Run("folderUID check", func(t *testing.T) {
		t.Run("matching is OK", func(t *testing.T) {
			cfg := &config{
				OrgID: 1,
			}

			dashboardJSON := simplejson.NewFromAny(map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":      "test-dashboard-uid",
					"namespace": "default",
					"annotations": map[string]interface{}{
						"grafana.app/folder": folderUID,
					},
				},
				"spec": map[string]interface{}{
					"title": "Test Dashboard",
				},
			})

			result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.Equal(t, folderUID, result.Dashboard.FolderUID)
		})

		t.Run("not matching is an error", func(t *testing.T) {
			cfg := &config{
				OrgID: 1,
			}

			dashboardJSON := simplejson.NewFromAny(map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":      "test-dashboard-uid",
					"namespace": "default",
					"annotations": map[string]interface{}{
						"grafana.app/folder": "different-folder-uid",
					},
				},
				"spec": map[string]interface{}{
					"title": "Test Dashboard",
				},
			})

			result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

			require.Error(t, err)
			assert.Nil(t, result)
			assert.Contains(t, err.Error(), "dashboard folderUID")
		})

		t.Run("not set is OK", func(t *testing.T) {
			cfg := &config{
				OrgID: 1,
			}

			dashboardJSON := simplejson.NewFromAny(map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":      "test-dashboard-uid",
					"namespace": "default",
				},
				"spec": map[string]interface{}{
					"title": "Test Dashboard",
				},
			})

			result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.Equal(t, folderUID, result.Dashboard.FolderUID)
		})
	})

	t.Run("empty title is an error", func(t *testing.T) {
		cfg := &config{
			OrgID: 1,
		}

		dashboardJSON := simplejson.NewFromAny(map[string]any{
			"title": "",
		})

		result, err := createDashboardJSON(dashboardJSON, lastModified, cfg, folderID, folderUID)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, dashboards.ErrDashboardTitleEmpty, err)
	})
}

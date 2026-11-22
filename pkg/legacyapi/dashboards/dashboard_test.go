package dashboards

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newDashboardObject(t *testing.T, apiVersion string, spec map[string]any) (*unstructured.Unstructured, utils.GrafanaMetaAccessor) {
	t.Helper()

	item := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": apiVersion,
		"kind":       "Dashboard",
		"metadata": map[string]any{
			"name":       "abc",
			"generation": int64(3),
		},
		"spec": spec,
	}}
	meta, err := utils.MetaAccessor(item)
	require.NoError(t, err)
	return item, meta
}

func TestFromUnstructured(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	updated := created.Add(time.Hour)

	t.Run("maps metadata and spec", func(t *testing.T) {
		item, meta := newDashboardObject(t, "dashboard.grafana.app/v1", map[string]any{
			"title": "My Dashboard",
		})
		meta.SetCreationTimestamp(metav1.NewTime(created))
		meta.SetUpdatedTimestamp(&updated)
		meta.SetCreatedBy("user:creator")
		meta.SetUpdatedBy("user:updater")
		meta.SetFolder("folder-a")
		meta.SetDeprecatedInternalID(42) // nolint:staticcheck

		dash, err := FromUnstructured(item)
		require.NoError(t, err)

		assert.Equal(t, int64(42), dash.ID)
		assert.Equal(t, "abc", dash.UID)
		assert.Equal(t, "My Dashboard", dash.Title)
		assert.Equal(t, "my-dashboard", dash.Slug)
		assert.Equal(t, "folder-a", dash.FolderUID)
		assert.Equal(t, 3, dash.Version)
		assert.Equal(t, "v1", dash.APIVersion)
		assert.Equal(t, "user:creator", dash.CreatedBy)
		assert.Equal(t, "user:updater", dash.UpdatedBy)
		assert.True(t, created.Equal(dash.Created))
		assert.True(t, updated.Equal(dash.Updated))
		assert.Equal(t, time.Local, dash.Updated.Location())
		assert.True(t, dash.Deleted.IsZero())
		assert.Equal(t, map[string]any{
			"title":   "My Dashboard",
			"uid":     "abc",
			"version": int64(3),
		}, dash.Data)
	})

	t.Run("updated defaults to created", func(t *testing.T) {
		item, meta := newDashboardObject(t, "dashboard.grafana.app/v1", map[string]any{"title": "x"})
		meta.SetCreationTimestamp(metav1.NewTime(created))

		dash, err := FromUnstructured(item)
		require.NoError(t, err)
		assert.True(t, created.Equal(dash.Updated))
	})

	t.Run("general folder maps to the legacy root", func(t *testing.T) {
		item, meta := newDashboardObject(t, "dashboard.grafana.app/v1", map[string]any{"title": "x"})
		meta.SetFolder("general")

		dash, err := FromUnstructured(item)
		require.NoError(t, err)
		assert.Equal(t, "", dash.FolderUID)
	})

	t.Run("legacy fields in the spec", func(t *testing.T) {
		item, _ := newDashboardObject(t, "dashboard.grafana.app/v0alpha1", map[string]any{
			"title":     "x",
			"id":        int64(7),
			"gnet_id":   int64(9),
			"is_folder": true,
			"has_acl":   true,
		})

		dash, err := FromUnstructured(item)
		require.NoError(t, err)
		assert.Equal(t, int64(7), dash.ID)
		assert.Equal(t, int64(9), dash.GnetID)
		assert.True(t, dash.IsFolder)
		assert.True(t, dash.HasACL)
		assert.NotContains(t, dash.Data, "id")
	})

	t.Run("plugin manager sets the plugin ID", func(t *testing.T) {
		item, meta := newDashboardObject(t, "dashboard.grafana.app/v1", map[string]any{"title": "x"})
		meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindPlugin, Identity: "my-plugin"})

		dash, err := FromUnstructured(item)
		require.NoError(t, err)
		assert.Equal(t, "my-plugin", dash.PluginID)
	})

	t.Run("deletion timestamp", func(t *testing.T) {
		item, meta := newDashboardObject(t, "dashboard.grafana.app/v1", map[string]any{"title": "x"})
		deleted := metav1.NewTime(updated)
		meta.SetDeletionTimestamp(&deleted)

		dash, err := FromUnstructured(item)
		require.NoError(t, err)
		assert.True(t, updated.Equal(dash.Deleted))
	})

	t.Run("missing spec", func(t *testing.T) {
		item, _ := newDashboardObject(t, "dashboard.grafana.app/v1", nil)
		delete(item.Object, "spec")

		_, err := FromUnstructured(item)
		require.Error(t, err)
	})
}

func TestFromConverted(t *testing.T) {
	t.Run("uses the converted object", func(t *testing.T) {
		item, _ := newDashboardObject(t, "dashboard.grafana.app/v2beta1", map[string]any{"title": "x"})

		dash, err := FromConverted(item)
		require.NoError(t, err)
		assert.Equal(t, "v2beta1", dash.APIVersion)
		assert.Equal(t, "x", dash.Data["title"])
	})

	t.Run("falls back to the stored version when conversion failed", func(t *testing.T) {
		item, _ := newDashboardObject(t, "dashboard.grafana.app/v2beta1", map[string]any{"title": "x"})
		item.Object["status"] = map[string]any{
			"conversion": map[string]any{
				"failed":        true,
				"storedVersion": "v1",
				"source":        map[string]any{"title": "stored"},
			},
		}

		dash, err := FromConverted(item)
		require.NoError(t, err)
		assert.Equal(t, "v1", dash.APIVersion)
		assert.Equal(t, map[string]any{"title": "stored"}, dash.Data)
		assert.Equal(t, "x", dash.Title)
	})
}

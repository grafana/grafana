package provisioning

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestLibraryPanelFilesPreserveSettingsInUnifiedStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("starts a local Grafana API server")
	}
	helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
		opts.UnifiedStorageConfig[setting.LibraryPanelResource] = setting.UnifiedStorageConfig{DualWriterMode: grafanarest.Mode5}
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder", "dashboard.grafana.app/Dashboard:folder",
			"dashboard.grafana.app/LibraryPanel:folder",
		}
	})
	helper.CreateLocalRepo(t, common.TestRepo{
		Name: "panel-repo", LocalPath: helper.ProvisioningPath, SyncTarget: "instance", Workflows: []string{"write"},
	})
	files := helper.NewFilesClient("panel-repo")
	body := []byte(`{
				"apiVersion":"dashboard.grafana.app/v0alpha1", "kind":"LibraryPanel",
				"metadata":{"name":"git-panel"},
				"spec":{"type":"timeseries","title":"Git panel","options":{},"fieldConfig":{}},
				"status":{"missing":{
					"transformations":[{"id":"reduce","options":{}}], "maxDataPoints":100,
					"timeFrom":"1h", "repeat":"host", "repeatDirection":"h", "maxPerRow":3
				}}
			}`)
	response := files.Post(t, "panel.json", body)
	require.Equal(t, http.StatusOK, response.StatusCode, response.BodyString())

	raw, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, "panel.json"))
	require.NoError(t, err)
	var saved unstructured.Unstructured
	require.NoError(t, json.Unmarshal(raw, &saved))
	require.NotContains(t, saved.Object, "status")
	require.NoError(t, unstructured.SetNestedField(saved.Object, int64(200), "spec", "additionalProperties", "maxDataPoints"))
	updated, err := json.Marshal(saved.Object)
	require.NoError(t, err)
	response = files.Put(t, "panel.json", updated)
	require.Equal(t, http.StatusOK, response.StatusCode, response.BodyString())

	helper.SyncAndWait(t, "panel-repo", nil)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin, Namespace: "default", GVR: dashboardV0.LibraryPanelResourceInfo.GroupVersionResource(),
	})
	panel, err := client.Resource.Get(t.Context(), "git-panel", metav1.GetOptions{})
	require.NoError(t, err)
	settings, found, err := unstructured.NestedMap(panel.Object, "spec", "additionalProperties")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, map[string]any{
		"transformations": []any{map[string]any{"id": "reduce", "options": map[string]any{}}},
		"maxDataPoints":   int64(200), "timeFrom": "1h", "repeat": "host", "repeatDirection": "h", "maxPerRow": int64(3),
	}, settings)

	response = files.Post(t, "renamed.json?originalPath=panel.json", nil)
	require.Equal(t, http.StatusOK, response.StatusCode, response.BodyString())
	raw, err = os.ReadFile(filepath.Join(helper.ProvisioningPath, "renamed.json"))
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &saved))
	require.NotContains(t, saved.Object, "status")
	moved, found, err := unstructured.NestedMap(saved.Object, "spec", "additionalProperties")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, settings, moved)

	require.NoError(t, unstructured.SetNestedMap(saved.Object, map[string]any{}, "spec", "additionalProperties"))
	cleared, err := json.Marshal(saved.Object)
	require.NoError(t, err)
	response = files.Put(t, "renamed.json", cleared)
	require.Equal(t, http.StatusOK, response.StatusCode, response.BodyString())
	helper.SyncAndWait(t, "panel-repo", nil)
	panel, err = client.Resource.Get(t.Context(), "git-panel", metav1.GetOptions{})
	require.NoError(t, err)
	settings, found, err = unstructured.NestedMap(panel.Object, "spec", "additionalProperties")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, map[string]any{}, settings)
}

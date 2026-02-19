package resources

import (
	"bytes"
	"context"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestUtils(t *testing.T) {
	t.Run("load playlist json", func(t *testing.T) {
		obj, gvk, err := DecodeYAMLObject(bytes.NewReader([]byte(`{
			"kind": "Playlist",
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"metadata": {
				"name": "hello"
			},
			"spec": {
				"title": "Playlist from provisioning"
			}
		}`)))

		require.NoError(t, err)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "playlist.grafana.app",
			Version: "v0alpha1",
			Kind:    "Playlist",
		}, gvk)
		require.NotNil(t, obj)
	})

	t.Run("YAML Parsing", func(t *testing.T) {
		obj, gvk, err := DecodeYAMLObject(bytes.NewReader([]byte("kind: xyz\npi: 3.1415")))
		require.NoError(t, err)
		require.NotNil(t, gvk)
		require.Equal(t, "xyz", obj.Object["kind"])
		require.Equal(t, 3.1415, obj.Object["pi"])

		// // Tabs in the value
		// _, _, err = LoadYAMLOrJSON(bytes.NewReader([]byte("kind: xyz\n\tpi: 3.1415")))
		// require.Equal(t, ErrYamlContainsTabs, err)
	})

	t.Run("load playlist yaml", func(t *testing.T) {
		obj, gvk, err := DecodeYAMLObject(bytes.NewReader([]byte(`
apiVersion: playlist.grafana.app/v0alpha1
kind: Playlist
metadata:
  name: hello
spec:
  title: a title
`)))

		require.NoError(t, err)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "playlist.grafana.app",
			Version: "v0alpha1",
			Kind:    "Playlist",
		}, gvk)
		require.NotNil(t, obj)
	})

	t.Run("load dashboard json", func(t *testing.T) {
		// Support dashboard conversion
		obj, gvk, classic, err := ReadClassicResource(context.Background(), &repository.FileInfo{
			Data: []byte(`{
			"schemaVersion": 7,
			"panels": [],
			"tags": []
		}`),
		})

		require.NoError(t, err)
		require.Equal(t, provisioning.ClassicDashboard, classic)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, gvk)
		require.NotNil(t, obj)
	})

	t.Run("lint dashboard", func(t *testing.T) {
		var err error
		info := &repository.FileInfo{
			Path: "devenv/dev-dashboards/panel-timeline/timeline-demo.json",
		}
		info.Data, err = os.ReadFile(path.Join("../../../../..", info.Path))
		require.NoError(t, err)

		parser := &parser{
			repo: provisioning.ResourceRepositoryInfo{
				Name: "test",
			},
		}

		// Support dashboard conversion
		parsed, err := parser.Parse(context.Background(), info)
		require.EqualError(t, err, "no clients configured")
		err = parsed.DryRun(context.Background())
		require.EqualError(t, err, "no client configured")

		require.Equal(t, provisioning.ClassicDashboard, parsed.Classic)
		require.Equal(t, schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, parsed.GVK)
	})

	t.Run("load dashboard with UTF-8 BOM prefix", func(t *testing.T) {
		// UTF-8 BOM is EF BB BF at the start of the file
		dashboardJSON := make([]byte, 0, 96)
		dashboardJSON = append(dashboardJSON, 0xEF, 0xBB, 0xBF)
		dashboardJSON = append(dashboardJSON, []byte(`{
			"title": "Dashboard with BOM",
			"schemaVersion": 7,
			"panels": [],
			"tags": []
		}`)...)

		obj, gvk, classic, err := ReadClassicResource(context.Background(), &repository.FileInfo{
			Data: dashboardJSON,
		})

		require.NoError(t, err)
		require.Equal(t, provisioning.ClassicDashboard, classic)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, gvk)
		require.NotNil(t, obj)

		// Verify BOM was stripped from the stored dashboard
		spec, ok := obj.Object["spec"].(map[string]any)
		require.True(t, ok)
		title, ok := spec["title"].(string)
		require.True(t, ok)
		require.Equal(t, "Dashboard with BOM", title)
		require.NotContains(t, title, "\ufeff", "BOM should be stripped from title")
	})

	t.Run("load dashboard with Unicode BOM in strings", func(t *testing.T) {
		// Dashboard with BOM characters embedded in string values
		obj, gvk, classic, err := ReadClassicResource(context.Background(), &repository.FileInfo{
			Data: []byte(`{
				"title": "\ufeffDashboard Title",
				"description": "Description\ufeffwith BOM",
				"schemaVersion": 7,
				"panels": [
					{
						"title": "\ufeffPanel 1",
						"type": "graph"
					}
				],
				"tags": []
			}`),
		})

		require.NoError(t, err)
		require.Equal(t, provisioning.ClassicDashboard, classic)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, gvk)
		require.NotNil(t, obj)

		// Verify BOMs were stripped from all fields
		spec, ok := obj.Object["spec"].(map[string]any)
		require.True(t, ok)

		title, ok := spec["title"].(string)
		require.True(t, ok)
		require.Equal(t, "Dashboard Title", title, "BOM should be stripped from title")
		require.NotContains(t, title, "\ufeff")

		description, ok := spec["description"].(string)
		require.True(t, ok)
		require.Equal(t, "Descriptionwith BOM", description, "BOM should be stripped from description")
		require.NotContains(t, description, "\ufeff")

		panels, ok := spec["panels"].([]any)
		require.True(t, ok)
		require.Len(t, panels, 1)

		panel := panels[0].(map[string]any)
		panelTitle, ok := panel["title"].(string)
		require.True(t, ok)
		require.Equal(t, "Panel 1", panelTitle, "BOM should be stripped from panel title")
		require.NotContains(t, panelTitle, "\ufeff")
	})

	t.Run("load YAML dashboard with BOM", func(t *testing.T) {
		// YAML dashboard with UTF-8 BOM prefix
		yamlData := make([]byte, 0, 173)
		yamlData = append(yamlData, 0xEF, 0xBB, 0xBF)
		yamlData = append(yamlData, []byte(`
apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Dashboard with BOM
  schemaVersion: 7
  panels: []
  tags: []
`)...)

		obj, gvk, err := DecodeYAMLObject(bytes.NewReader(yamlData))

		require.NoError(t, err)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, gvk)
		require.NotNil(t, obj)

		// Verify BOM was stripped
		spec, ok := obj.Object["spec"].(map[string]any)
		require.True(t, ok)
		title, ok := spec["title"].(string)
		require.True(t, ok)
		require.NotContains(t, title, "\ufeff", "BOM should be stripped from YAML content")
	})

	t.Run("load playlist YAML with embedded BOMs", func(t *testing.T) {
		obj, gvk, err := DecodeYAMLObject(bytes.NewReader([]byte(`
apiVersion: playlist.grafana.app/v0alpha1
kind: Playlist
metadata:
  name: hello
spec:
  title: "\ufeffPlaylist Title\ufeff"
  items:
    - title: "\ufeffItem 1"
    - title: "Item 2\ufeff"
`)))

		require.NoError(t, err)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "playlist.grafana.app",
			Version: "v0alpha1",
			Kind:    "Playlist",
		}, gvk)
		require.NotNil(t, obj)

		// Note: YAML decoder may handle BOMs differently than JSON
		// This test verifies the file can be parsed successfully
		spec, ok := obj.Object["spec"].(map[string]any)
		require.True(t, ok)
		require.NotNil(t, spec["title"])
	})
}

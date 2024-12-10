package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/lint"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func TestUtils(t *testing.T) {
	t.Run("load playlist json", func(t *testing.T) {
		obj, gvk, err := LoadYAMLOrJSON(bytes.NewReader([]byte(`{
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
		obj, gvk, err := LoadYAMLOrJSON(bytes.NewReader([]byte("kind: xyz\npi: 3.1415")))
		require.NoError(t, err)
		require.NotNil(t, gvk)
		require.Equal(t, "xyz", obj.Object["kind"])
		require.Equal(t, 3.1415, obj.Object["pi"])

		// // Tabs in the value
		// _, _, err = LoadYAMLOrJSON(bytes.NewReader([]byte("kind: xyz\n\tpi: 3.1415")))
		// require.Equal(t, ErrYamlContainsTabs, err)
	})

	t.Run("load playlist yaml", func(t *testing.T) {
		obj, gvk, err := LoadYAMLOrJSON(bytes.NewReader([]byte(`
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
		obj, gvk, classic, err := ReadClassicResource(context.Background(), slog.Default(), &repository.FileInfo{
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
		info.Data, err = os.ReadFile(filepath.Join("../../../../..", info.Path))
		require.NoError(t, err)

		parser := NewParser(&provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test",
			},
		}, &DynamicClient{}, &StaticKindsLookup{})

		// try to validate (and lint)
		validate := true
		parser.SetLinter(lint.NewDashboardLinter())

		// Support dashboard conversion
		parsed, err := parser.Parse(context.Background(), slog.Default(), info, validate)

		require.NoError(t, err)
		require.Equal(t, provisioning.ClassicDashboard, parsed.Classic)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, parsed.GVK)

		jj, err := json.MarshalIndent(parsed.Lint, "", "  ")
		require.NoError(t, err)
		// fmt.Printf("%s\n", string(jj))
		require.JSONEq(t, `[
			{
				"severity": "error",
				"rule": "template-datasource-rule",
				"message": "Dashboard 'Timeline Demo' does not have a templated data source"
			},
			{
				"severity": "error",
				"rule": "uneditable-dashboard",
				"message": "Dashboard 'Timeline Demo' is editable, it should be set to 'editable: false'"
			}
		]`, string(jj))
	})
}

package resources

import (
	"bytes"
	"context"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
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

		parser := &Parser{
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
}

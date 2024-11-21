package provisioning

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
		obj, gvk, err := FallbackResourceLoader([]byte(`{
			"schemaVersion": 7,
			"panels": [],
			"tags": []
		}`))

		require.NoError(t, err)
		require.Equal(t, &schema.GroupVersionKind{
			Group:   "dashboards.grafana.app",
			Version: "v0alpha1",
			Kind:    "Dashboard",
		}, gvk)
		require.NotNil(t, obj)
	})
}

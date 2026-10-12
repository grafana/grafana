package unified

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestLoadEmbeddedAppManifests(t *testing.T) {
	root := t.TempDir()
	manifests, err := loadEmbeddedAppManifests(root)
	require.NoError(t, err)
	require.Empty(t, manifests)

	dir := filepath.Join(root, "appmanifests")
	require.NoError(t, os.Mkdir(dir, 0o700))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "widgets.yaml"), []byte(`
apiVersion: apps.grafana.app/v1alpha2
kind: AppManifest
metadata:
  name: customcrdtest
spec:
  appName: customcrdtest
  group: customcrdtest.ext.grafana.app
  versions:
    - name: v1
      served: true
      kinds:
        - kind: RootWidget
          plural: RootWidgets
          scope: Namespaced
          searchFields:
            - name: loadZone
              path: spec.loadZones[*].name
              type: string
              array: true
              capabilities: [filter, retrieve]
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ignored
`), 0o600))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ignored.txt"), []byte("not a manifest"), 0o600))

	manifests, err = loadEmbeddedAppManifests(root)
	require.NoError(t, err)
	require.Len(t, manifests, 1)

	registry := resource.NewSearchFieldsRegistry(nil, nil, nil)
	require.NoError(t, (resource.SearchOptions{SearchFields: registry}).ReloadManifests(nil, manifests))
	_, hash, provider := registry.For(resource.NewLowerGroupResource("customcrdtest.ext.grafana.app", "rootwidgets"))
	require.NotEmpty(t, hash)
	require.NotNil(t, provider)
	fields := provider.Fields(schema.GroupVersionResource{Group: "customcrdtest.ext.grafana.app", Version: "v1", Resource: "rootwidgets"})
	require.Len(t, fields, 1)
	require.Equal(t, "loadZone", fields[0].Name)
	require.Equal(t, "spec.loadZones[*].name", fields[0].Path)
	require.True(t, fields[0].Array)

	require.NoError(t, os.WriteFile(filepath.Join(dir, "bad.yaml"), []byte("kind: AppManifest\nspec: ["), 0o600))
	manifests, err = loadEmbeddedAppManifests(root)
	require.ErrorContains(t, err, "bad.yaml")
	require.Len(t, manifests, 1, "a bad file must not hide the other app's fields")
}

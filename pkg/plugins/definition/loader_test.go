package definition

import (
	"context"
	"errors"
	"io/fs"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
)

func manifestFS(content string) fstest.MapFS {
	return fstest.MapFS{appSDKManifestFile: &fstest.MapFile{Data: []byte(content)}}
}

func TestLoadManifest(t *testing.T) {
	t.Run("missing manifest returns nil", func(t *testing.T) {
		m, err := loadManifest(fstest.MapFS{})
		require.NoError(t, err)
		require.Nil(t, m)
	})

	t.Run("v1alpha2", func(t *testing.T) {
		m, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha2",
			"kind": "AppManifest",
			"spec": {"appName": "test", "group": "test-app", "versions": []}
		}`))
		require.NoError(t, err)
		require.NotNil(t, m)
		require.Equal(t, "test", m.AppName)
		require.Equal(t, "test-app", m.Group)
	})

	t.Run("v1alpha1", func(t *testing.T) {
		m, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha1",
			"kind": "AppManifest",
			"spec": {"appName": "old", "group": "old-app", "versions": []}
		}`))
		require.NoError(t, err)
		require.NotNil(t, m)
		require.Equal(t, "old", m.AppName)
	})

	t.Run("unsupported apiVersion", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{"apiVersion": "apps.grafana.app/v9beta9", "spec": {}}`))
		require.ErrorContains(t, err, "unsupported AppManifest apiVersion")
	})

	// Without a declared apiVersion there is no way to tell which CR schema the
	// file follows, and guessing would silently drop version-specific fields.
	t.Run("missing apiVersion", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{"spec": {"appName": "test", "group": "test-app"}}`))
		require.ErrorContains(t, err, `unsupported AppManifest apiVersion ""`)
	})

	t.Run("malformed json", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{not json`))
		require.Error(t, err)
	})
}

// A bad manifest must not fail the whole plugin load (it runs during server
// startup): the plugin is served without its manifest kinds instead.
func TestLoadInfoToleratesBadManifest(t *testing.T) {
	info, err := loadInfo(manifestFS(`{not json`), plugins.JSONData{ID: "test-app"}, Options{
		Schemas:     true,
		AppManifest: true,
	})
	require.NoError(t, err)
	require.Nil(t, info.Manifest)
	require.Equal(t, "test-app", info.JSONData.ID)
}

func TestLoadManifestIOErrors(t *testing.T) {
	t.Run("open failures other than not-exist are reported", func(t *testing.T) {
		_, err := loadManifest(errFS{openErr: errors.New("permission denied")})
		require.ErrorContains(t, err, "opening "+appSDKManifestFile)
		require.ErrorContains(t, err, "permission denied")
	})

	t.Run("read failures are reported", func(t *testing.T) {
		_, err := loadManifest(errFS{readErr: errors.New("boom")})
		require.ErrorContains(t, err, "reading "+appSDKManifestFile)
		require.ErrorContains(t, err, "boom")
	})
}

// errFS is an fs.FS that fails on open or, when only readErr is set, hands back
// a file that fails once loadManifest reaches io.ReadAll.
type errFS struct {
	openErr error
	readErr error
}

func (f errFS) Open(string) (fs.File, error) {
	if f.openErr != nil {
		return nil, f.openErr
	}
	return errFile{err: f.readErr}, nil
}

type errFile struct{ err error }

func (f errFile) Stat() (fs.FileInfo, error) { return nil, f.err }
func (f errFile) Read([]byte) (int, error)   { return 0, f.err }
func (f errFile) Close() error               { return nil }

func TestLoadManifestDecodeErrors(t *testing.T) {
	t.Run("v1alpha2 spec that does not match the CR", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha2",
			"spec": {"appName": 42}
		}`))
		require.ErrorContains(t, err, "decoding AppManifest CR")
	})

	t.Run("v1alpha1 spec that does not match the CR", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha1",
			"spec": {"appName": 42}
		}`))
		require.ErrorContains(t, err, "decoding AppManifest CR")
	})

	t.Run("spec that cannot be converted to ManifestData", func(t *testing.T) {
		// The SDK requires a kind's schemas map to carry an entry named after
		// the kind itself.
		_, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha2",
			"spec": {
				"appName": "test",
				"group": "test-app",
				"versions": [{
					"name": "v1",
					"kinds": [{"kind": "Widget", "schemas": {"Gadget": {"type": "object"}}}]
				}]
			}
		}`))
		require.ErrorContains(t, err, "converting AppManifestSpec to ManifestData")
	})
}

const validSchema = `{"targetApiVersion": "v0alpha1", "settings": {"spec": {"type": "object"}}}`

func TestLoadInfo(t *testing.T) {
	jsonData := plugins.JSONData{ID: "test-app"}

	t.Run("no options loads only the plugin json", func(t *testing.T) {
		info, err := loadInfo(manifestFS(`{"apiVersion": "apps.grafana.app/v1alpha2",
			"spec": {"appName": "test", "group": "test-app", "versions": []}}`), jsonData, Options{})
		require.NoError(t, err)
		assert.Equal(t, "test-app", info.JSONData.ID)
		assert.Nil(t, info.Manifest, "manifest is only read when requested")
		assert.Nil(t, info.Schemas, "schemas are only read when requested")
	})

	t.Run("loads the manifest when requested", func(t *testing.T) {
		info, err := loadInfo(manifestFS(`{"apiVersion": "apps.grafana.app/v1alpha2",
			"spec": {"appName": "test", "group": "test-app", "versions": []}}`), jsonData,
			Options{AppManifest: true})
		require.NoError(t, err)
		require.NotNil(t, info.Manifest)
		assert.Equal(t, "test-app", info.Manifest.Group)
	})

	t.Run("loads the v0alpha1 schema when requested", func(t *testing.T) {
		info, err := loadInfo(fstest.MapFS{
			"schema/v0alpha1.json": &fstest.MapFile{Data: []byte(validSchema)},
		}, jsonData, Options{Schemas: true})
		require.NoError(t, err)
		require.Contains(t, info.Schemas, "v0alpha1")
		assert.False(t, info.Schemas["v0alpha1"].IsZero())
	})

	t.Run("missing schema leaves schemas nil", func(t *testing.T) {
		info, err := loadInfo(fstest.MapFS{}, jsonData, Options{Schemas: true})
		require.NoError(t, err)
		assert.Nil(t, info.Schemas, "an empty schema should not be registered")
	})

	t.Run("malformed schema is an error", func(t *testing.T) {
		info, err := loadInfo(fstest.MapFS{
			"schema/v0alpha1.json": &fstest.MapFile{Data: []byte(`{"targetApiVersion":`)},
		}, jsonData, Options{Schemas: true})
		require.ErrorContains(t, err, "error loading schema test-app")
		assert.Equal(t, "test-app", info.JSONData.ID, "the partial info is still returned")
	})

	t.Run("mismatched targetApiVersion is an error", func(t *testing.T) {
		_, err := loadInfo(fstest.MapFS{
			"schema/v0alpha1.json": &fstest.MapFile{Data: []byte(`{"targetApiVersion": "v1beta1"}`)},
		}, jsonData, Options{Schemas: true})
		require.ErrorContains(t, err, "error loading schema test-app")
	})
}

// bundle builds a FoundBundle whose primary plugin has the given id, plus one
// child per childID, all sharing the same in-memory files.
func bundle(files map[string][]byte, id string, childIDs ...string) *plugins.FoundBundle {
	b := &plugins.FoundBundle{
		Primary: plugins.FoundPlugin{
			JSONData: plugins.JSONData{ID: id, Type: plugins.TypeApp},
			FS:       plugins.NewInMemoryFS(files),
		},
	}
	for _, childID := range childIDs {
		b.Children = append(b.Children, &plugins.FoundPlugin{
			JSONData: plugins.JSONData{ID: childID, Type: plugins.TypeDataSource},
			FS:       plugins.NewInMemoryFS(files),
		})
	}
	return b
}

func sourceRegistry(sources ...*pluginfakes.FakePluginSource) *pluginfakes.FakeSourceRegistry {
	return &pluginfakes.FakeSourceRegistry{
		ListFunc: func(context.Context) []plugins.PluginSource {
			out := make([]plugins.PluginSource, 0, len(sources))
			for _, s := range sources {
				out = append(out, s)
			}
			return out
		},
	}
}

func discovers(bundles ...*plugins.FoundBundle) *pluginfakes.FakePluginSource {
	return &pluginfakes.FakePluginSource{
		DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) { return bundles, nil },
	}
}

func ids(t *testing.T, defs []PluginDefinition) []string {
	t.Helper()
	out := make([]string, 0, len(defs))
	for _, d := range defs {
		out = append(out, d.JSONData.ID)
	}
	return out
}

func TestLoadPluginDefinition(t *testing.T) {
	ctx := context.Background()

	t.Run("no sources returns nothing", func(t *testing.T) {
		defs, err := LoadPluginDefinition(ctx, sourceRegistry(), Options{})
		require.NoError(t, err)
		assert.Empty(t, defs)
	})

	t.Run("a nil filter keeps every plugin and child", func(t *testing.T) {
		defs, err := LoadPluginDefinition(ctx,
			sourceRegistry(discovers(bundle(nil, "app-one", "child-one"))), Options{})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"app-one", "child-one"}, ids(t, defs))
	})

	t.Run("the filter is applied to primaries and children", func(t *testing.T) {
		defs, err := LoadPluginDefinition(ctx,
			sourceRegistry(discovers(bundle(nil, "app-one", "child-one", "child-two"))),
			Options{
				Filter: func(j plugins.JSONData) bool { return j.ID != "child-one" },
			})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"app-one", "child-two"}, ids(t, defs))
	})

	t.Run("a filtered-out primary does not hide its children", func(t *testing.T) {
		defs, err := LoadPluginDefinition(ctx,
			sourceRegistry(discovers(bundle(nil, "app-one", "child-one"))),
			Options{
				Filter: func(j plugins.JSONData) bool { return j.Type == plugins.TypeDataSource },
			})
		require.NoError(t, err)
		assert.Equal(t, []string{"child-one"}, ids(t, defs))
	})

	t.Run("a child shared by two bundles is loaded once", func(t *testing.T) {
		defs, err := LoadPluginDefinition(ctx, sourceRegistry(discovers(
			bundle(nil, "app-one", "shared-child"),
			bundle(nil, "app-two", "shared-child"),
		)), Options{})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"app-one", "app-two", "shared-child"}, ids(t, defs))
	})

	t.Run("plugins found in more than one source are loaded once", func(t *testing.T) {
		defs, err := LoadPluginDefinition(ctx, sourceRegistry(
			discovers(bundle(nil, "app-one", "child-one")),
			discovers(bundle(nil, "app-one", "child-one")),
		), Options{})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"app-one", "child-one"}, ids(t, defs))
	})

	t.Run("discover errors abort the load", func(t *testing.T) {
		failing := &pluginfakes.FakePluginSource{
			DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
				return nil, errors.New("discover failed")
			},
		}
		_, err := LoadPluginDefinition(ctx, sourceRegistry(failing), Options{})
		require.ErrorContains(t, err, "discover failed")
	})

	t.Run("schemas and manifests are loaded through to the definition", func(t *testing.T) {
		files := map[string][]byte{
			"schema/v0alpha1.json": []byte(validSchema),
			appSDKManifestFile: []byte(`{"apiVersion": "apps.grafana.app/v1alpha2",
				"spec": {"appName": "one", "group": "app-one", "versions": []}}`),
		}
		defs, err := LoadPluginDefinition(ctx,
			sourceRegistry(discovers(bundle(files, "app-one"))),
			Options{Schemas: true, AppManifest: true})
		require.NoError(t, err)
		require.Len(t, defs, 1)
		require.NotNil(t, defs[0].Manifest)
		assert.Equal(t, "app-one", defs[0].Manifest.Group)
		assert.Contains(t, defs[0].Schemas, "v0alpha1")
	})

	t.Run("a load error aborts the load", func(t *testing.T) {
		files := map[string][]byte{"schema/v0alpha1.json": []byte(`{"targetApiVersion":`)}
		_, err := LoadPluginDefinition(ctx,
			sourceRegistry(discovers(bundle(files, "app-one"))), Options{Schemas: true})
		require.ErrorContains(t, err, "error loading schema app-one")
	})

	t.Run("a child load error aborts the load", func(t *testing.T) {
		good := plugins.NewInMemoryFS(nil)
		bad := plugins.NewInMemoryFS(map[string][]byte{
			"schema/v0alpha1.json": []byte(`{"targetApiVersion":`),
		})
		b := &plugins.FoundBundle{
			Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "app-one"}, FS: good},
			Children: []*plugins.FoundPlugin{
				{JSONData: plugins.JSONData{ID: "child-one"}, FS: bad},
			},
		}
		_, err := LoadPluginDefinition(ctx, sourceRegistry(discovers(b)), Options{Schemas: true})
		require.ErrorContains(t, err, "error loading schema child-one")
	})
}

package pluginrouter

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-logr/logr"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin/pluginroute"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// TestMain quiets the apiserver machinery each backend build reports on.
func TestMain(m *testing.M) {
	klog.SetLogger(logr.Discard())
	os.Exit(m.Run())
}

func TestLoadServesOneBackendPerManifest(t *testing.T) {
	loader := testLoader(t, "testdata/with-manifest", "testdata/no-manifest")

	backends, err := loader.Load(context.Background())
	require.NoError(t, err)

	// The plugin with no manifest declares no group, so there is nothing for
	// the router to route it by -- it is skipped rather than failing the load.
	require.Len(t, backends, 1)
	require.Equal(t, "routerexample.ext.grafana.app", backends[0].Group())
	require.NotEmpty(t, backends[0].RV())

	// The manifest the router advertises the group from, including the
	// settings version every app plugin serves.
	manifest := backends[0].Manifest()
	require.Equal(t, "routerexample.ext.grafana.app", manifest.Group)
	require.Equal(t, []string{"v1alpha1", "v0alpha1"}, versionNames(manifest))
}

// A manifest that serves no version of its own is still a served group: every
// app plugin serves its settings API whether or not the manifest mentions it.
// So this is a group with a settings API and nothing else -- not a plugin the
// loader drops, and not one that fails the load for the plugins beside it.
func TestLoadServesAManifestWithNoServedVersion(t *testing.T) {
	dir := t.TempDir()
	writeJSON(t, filepath.Join(dir, "settingsonly", "plugin.json"), map[string]any{
		"id": "grafana-settingsonly-app", "type": "app", "name": "Settings Only",
	})
	writeJSON(t, filepath.Join(dir, "settingsonly", "app-sdk-manifest.json"), map[string]any{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]any{"name": "settingsonly-app"},
		"spec": map[string]any{
			"appName": "settingsonly-app",
			"group":   "settingsonly.ext.grafana.app",
			"versions": []any{
				map[string]any{"name": "v1alpha1", "served": false, "kinds": []any{}},
			},
		},
	})

	loader := testLoader(t, filepath.Join(dir, "settingsonly"), "testdata/with-manifest")
	backends, err := loader.Load(context.Background())
	require.NoError(t, err)

	byGroup := map[string][]string{}
	for _, b := range backends {
		byGroup[b.Group()] = versionNames(b.Manifest())
	}
	require.Equal(t, map[string][]string{
		"settingsonly.ext.grafana.app":  {"v0alpha1"},
		"routerexample.ext.grafana.app": {"v1alpha1", "v0alpha1"},
	}, byGroup, "the unserved version must not be advertised, and its neighbour must be unaffected")
}

// A kind that declares admission is refused a nil plugin client when its
// storage is built, and this process runs no plugin backend. That must not cost
// the whole group: everything in it other than the hook is servable, and the
// hook itself fails closed per request.
func TestLoadServesKindsThatDeclareAdmission(t *testing.T) {
	dir := t.TempDir()
	writeJSON(t, filepath.Join(dir, "admission", "plugin.json"), map[string]any{
		"id": "grafana-admission-app", "type": "app", "name": "Admission",
	})
	writeJSON(t, filepath.Join(dir, "admission", "app-sdk-manifest.json"), map[string]any{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]any{"name": "admission-app"},
		"spec": map[string]any{
			"appName":          "admission-app",
			"group":            "admission.ext.grafana.app",
			"preferredVersion": "v1alpha1",
			"versions": []any{map[string]any{
				"name": "v1alpha1", "served": true,
				"kinds": []any{map[string]any{
					"kind": "TestKind", "plural": "TestKinds", "scope": "Namespaced",
					"admission": map[string]any{
						"validation": map[string]any{"operations": []any{"CREATE"}},
					},
					"schemas": map[string]any{
						"TestKind": map[string]any{"type": "object"},
					},
				}},
			}},
		},
	})

	loader := testLoader(t, filepath.Join(dir, "admission"))
	backends, err := loader.Load(context.Background())
	require.NoError(t, err)
	require.Len(t, backends, 1)

	// Load is where the kind's storage is built, and where a nil client would
	// have failed the group.
	handler, err := backends[0].Load(context.Background())
	require.NoError(t, err)
	require.NotNil(t, handler)
}

// The client that stands in for the plugin backend reports it is unreachable,
// so a declared hook fails closed rather than silently admitting.
func TestUnavailableClientFailsClosed(t *testing.T) {
	_, err := unavailableClient{}.AdmissionReview(context.Background(), nil)
	require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)

	_, err = unavailableClient{}.CallRoute(context.Background(), nil)
	require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)

	_, err = unavailableClient{}.ConvertObjects(context.Background(), nil)
	require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
}

// The router skips rebuilding a group whose RV has not moved, and keys its
// discovery and OpenAPI caches on it, so an edited manifest has to produce a
// different one even when the plugin version does not change.
func TestResourceVersionTracksTheManifest(t *testing.T) {
	plugin := definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "example-app", Info: plugins.Info{Version: "1.0.0"}},
		Manifest: &app.ManifestData{Group: "example.ext.grafana.app", PreferredVersion: "v1"},
	}

	first, err := resourceVersion(plugin)
	require.NoError(t, err)

	same, err := resourceVersion(plugin)
	require.NoError(t, err)
	require.Equal(t, first, same, "an unchanged plugin must not look changed")

	plugin.Manifest.PreferredVersion = "v2"
	edited, err := resourceVersion(plugin)
	require.NoError(t, err)
	require.NotEqual(t, first, edited, "an edited manifest must not be served from the old caches")
}

// The set is read from disk by a process that does not install plugins, so
// there is nothing to signal. Closing would cost the router one more reconcile
// before it parked the case.
func TestNotifyNeverFires(t *testing.T) {
	loader := testLoader(t, "testdata/with-manifest")

	dirty, err := loader.Notify(context.Background())
	require.NoError(t, err)
	require.NotNil(t, dirty)

	select {
	case _, ok := <-dirty:
		t.Fatalf("notify signalled (closed=%v)", !ok)
	case <-time.After(50 * time.Millisecond):
	}
}

func TestNewLoaderRejectsIncompleteOptions(t *testing.T) {
	_, err := NewLoader(LoaderOptions{Storage: testStorage})
	require.ErrorContains(t, err, "plugin sources are required")

	_, err = NewLoader(LoaderOptions{Sources: testSources(t, "testdata/with-manifest")})
	require.ErrorContains(t, err, "StorageProvider is required")
}

func TestIsAppPlugin(t *testing.T) {
	for _, tc := range []struct {
		name string
		json plugins.JSONData
		want bool
	}{
		{"an app plugin", plugins.JSONData{ID: "grafana-example-app", Type: plugins.TypeApp}, true},
		{"a datasource", plugins.JSONData{ID: "grafana-example-app", Type: plugins.TypeDataSource}, false},
		// The id becomes a path segment of the group when the manifest declares
		// none, so it has to be one segment, and not a version.
		{"an id with no dash", plugins.JSONData{ID: "example", Type: plugins.TypeApp}, false},
		{"an id with a dot", plugins.JSONData{ID: "example.app", Type: plugins.TypeApp}, false},
		{"an id that is a version", plugins.JSONData{ID: "v1", Type: plugins.TypeApp}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, isAppPlugin(tc.json))
		})
	}
}

func testLoader(t *testing.T, dirs ...string) *Loader {
	t.Helper()

	loader, err := NewLoader(LoaderOptions{
		Sources: testSources(t, dirs...),
		Storage: testStorage,
	})
	require.NoError(t, err)
	return loader
}

func testSources(t *testing.T, dirs ...string) pluginSources {
	t.Helper()

	abs := make([]string, 0, len(dirs))
	for _, dir := range dirs {
		path, err := filepath.Abs(dir)
		require.NoError(t, err)
		abs = append(abs, path)
	}
	return localSources{sources.NewUnsafeLocalSource(plugins.ClassExternal, abs)}
}

// localSources adapts a plugin source to the registry the definition loader
// takes.
type localSources struct {
	source plugins.PluginSource
}

func (s localSources) List(context.Context) []plugins.PluginSource {
	return []plugins.PluginSource{s.source}
}

// testStorage installs storage that is never read: these tests build backends
// and inspect what they describe, and never serve a request through one.
func testStorage(_ *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
	return apistore.NewRESTOptionsGetterForClient(nil, nil,
		storagebackend.Config{Codec: codecs.LegacyCodec(gvs...)}, nil, nil), nil
}

var _ pluginroute.StorageProvider = testStorage

func versionNames(manifest app.ManifestData) []string {
	names := make([]string, 0, len(manifest.Versions))
	for _, v := range manifest.Versions {
		names = append(names, v.Name)
	}
	return names
}

func writeJSON(t *testing.T, path string, value any) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, raw, 0o600))
}

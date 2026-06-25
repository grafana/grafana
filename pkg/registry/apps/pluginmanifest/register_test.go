package pluginmanifest

import (
	"context"
	"io"
	"io/fs"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// enabledFeatures returns feature toggles with the app-sdk manifest feature enabled.
func enabledFeatures() featuremgmt.FeatureToggles {
	return featuremgmt.WithFeatures(featuremgmt.FlagPluginsAppSDKManifest)
}

// manifestCR builds an AppManifest custom resource JSON document for the given group and a
// single kind, optionally declaring create-validation admission.
func manifestCR(appName, group, kind, plural string, withValidation bool) string {
	admission := ""
	if withValidation {
		admission = `,
            "admission": {
              "validation": {
                "operations": ["CREATE"]
              }
            }`
	}
	return `{
  "apiVersion": "apps.grafana.app/v1alpha2",
  "kind": "AppManifest",
  "metadata": { "name": "` + appName + `" },
  "spec": {
    "appName": "` + appName + `",
    "group": "` + group + `",
    "versions": [
      {
        "name": "v1",
        "kinds": [
          {
            "kind": "` + kind + `",
            "plural": "` + plural + `",
            "scope": "Namespaced"` + admission + `
          }
        ]
      }
    ]
  }
}`
}

// manifestFS returns a fake plugin FS that serves the given manifest JSON as
// app-sdk-manifest.json. A manifest of "" means the plugin ships no manifest file.
func manifestFS(manifestJSON string) *pluginfakes.FakePluginFS {
	fakeFS := pluginfakes.NewFakePluginFS("/test")
	fakeFS.OpenFunc = func(name string) (fs.File, error) {
		if name == appSDKManifestFile && manifestJSON != "" {
			return newFakeFile(manifestJSON), nil
		}
		return nil, fs.ErrNotExist
	}
	return fakeFS
}

func TestBuildInstallers(t *testing.T) {
	t.Run("returns no installers when feature is disabled", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		// A would-be installer that also panics if its manifest is read, proving the
		// disabled feature short-circuits before touching the plugin FS.
		fakeFS := pluginfakes.NewFakePluginFS("/test")
		fakeFS.OpenFunc = func(string) (fs.File, error) {
			t.Fatal("manifest should not be read when feature is disabled")
			return nil, nil
		}
		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test-app", Type: plugins.TypeApp},
			FS:       fakeFS,
		}

		installers, err := ProvideBuilder(featuremgmt.WithFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Empty(t, installers)
	})

	t.Run("reflects plugins added to the registry after the builder is constructed", func(t *testing.T) {
		// The builder is constructed at Wire-injection time but invoked at API server start.
		// Plugins loaded between those points (e.g. under the service-loading path, where the
		// registry is empty at injection time) must still produce installers.
		reg := pluginfakes.NewFakePluginRegistry()
		builder := ProvideBuilder(enabledFeatures(), reg, nil, nil)

		installers, err := builder.BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Empty(t, installers)

		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test-app", Type: plugins.TypeApp},
			FS:       manifestFS(manifestCR("test-app", "testapp.ext.grafana.com", "Thing", "things", false)),
		}

		installers, err = builder.BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Len(t, installers, 1)
	})

	t.Run("returns no installers when no plugins have manifests", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-app",
				Type: plugins.TypeApp,
			},
			FS: manifestFS(""),
		}

		installers, err := ProvideBuilder(enabledFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Empty(t, installers)
	})

	t.Run("creates installer for plugin with manifest", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-app",
				Type: plugins.TypeApp,
			},
			FS: manifestFS(manifestCR("test-app", "testapp.ext.grafana.com", "Thing", "things", false)),
		}

		installers, err := ProvideBuilder(enabledFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Len(t, installers, 1)
		require.Equal(t, []schema.GroupVersion{{Group: "testapp.ext.grafana.com", Version: "v1"}}, installers[0].GroupVersions())
	})

	t.Run("returns error for malformed manifest", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-app",
				Type: plugins.TypeApp,
			},
			FS: manifestFS("not valid json"),
		}

		installers, err := ProvideBuilder(enabledFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "test-app")
		require.Empty(t, installers)
	})

	t.Run("skips non-app plugins", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		reg.Store["test-datasource"] = &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-datasource",
				Type: plugins.TypeDataSource,
			},
			FS: manifestFS(manifestCR("ds-app", "dsapp.ext.grafana.com", "X", "xs", false)),
		}

		installers, err := ProvideBuilder(enabledFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Empty(t, installers)
	})

	t.Run("no admission plugin when manifest declares no admission", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test-app", Type: plugins.TypeApp},
			FS:       manifestFS(manifestCR("test-app", "testapp.ext.grafana.com", "Thing", "things", false)),
		}

		installers, err := ProvideBuilder(enabledFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Len(t, installers, 1)
		require.Nil(t, installers[0].AdmissionPlugin())
	})

	t.Run("registers admission plugin when a kind declares validation", func(t *testing.T) {
		reg := pluginfakes.NewFakePluginRegistry()
		reg.Store["test-app"] = &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test-app", Type: plugins.TypeApp},
			FS:       manifestFS(manifestCR("test-app", "testapp.ext.grafana.com", "Thing", "things", true)),
		}

		installers, err := ProvideBuilder(enabledFeatures(), reg, nil, nil).BuildInstallers(context.Background())
		require.NoError(t, err)
		require.Len(t, installers, 1)
		require.NotNil(t, installers[0].AdmissionPlugin())
	})
}

// fakeFile implements fs.File for testing with in-memory content.
type fakeFile struct {
	io.Reader
}

func newFakeFile(content string) *fakeFile {
	return &fakeFile{Reader: strings.NewReader(content)}
}

func (f *fakeFile) Stat() (fs.FileInfo, error) { return nil, nil }
func (f *fakeFile) Close() error               { return nil }

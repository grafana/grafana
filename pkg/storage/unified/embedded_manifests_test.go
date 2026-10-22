package unified

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
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

type gatedManifestDiscovery struct {
	resource.ManifestDiscovery
	ready chan struct{}
	items []appmanifestv1alpha2.AppManifest
}

func (d *gatedManifestDiscovery) ListManifests(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-d.ready:
		return &appmanifestv1alpha2.AppManifestList{Items: d.items}, nil
	}
}

func TestConfigureInProcessManifests_PreservesProvisioning(t *testing.T) {
	manifestJSON := func(kind, field string, revision int, enabled bool) []byte {
		return []byte(fmt.Sprintf(`{
			"apiVersion": "apps.grafana.app/v1alpha2",
			"kind": "AppManifest",
			"metadata": {"name": "custom"},
			"spec": {
				"appName": "custom",
				"group": "custom.ext.grafana.app",
				"embed": {"%ss": {"reembedVersion": %d}},
				"versions": [{
					"name": "v1", "served": true,
					"kinds": [{
						"kind": %q, "scope": "Namespaced",
						"searchFields": [{"name": %q, "path": "spec.%s", "type": "string", "capabilities": ["filter"]}],
						"search": {"global": %t, "hybrid": %t},
						"embed": {"fields": [{"name": %q, "path": "spec.%s"}]}
					}]
				}]
			}
		}`, strings.ToLower(kind), revision, kind, field, field, enabled, enabled, field, field))
	}

	for _, tc := range []struct {
		name         string
		discovered   string
		embedded     bool
		wantField    string
		wantRevision int
		wantEnabled  bool
	}{
		{"unrelated discovery preserves provisioning", "Gadget", true, "provisioned", 1, true},
		{"discovery overrides matching kind", "Widget", true, "discovered", 2, false},
		{"disabled extensions ignore provisioning", "Gadget", false, "", 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			dir := filepath.Join(root, "appmanifests")
			require.NoError(t, os.Mkdir(dir, 0o700))
			require.NoError(t, os.WriteFile(filepath.Join(dir, "widgets.json"), manifestJSON("Widget", "provisioned", 1, true), 0o600))

			var discovered appmanifestv1alpha2.AppManifest
			require.NoError(t, json.Unmarshal(manifestJSON(tc.discovered, "discovered", 2, false), &discovered))
			discovery := &gatedManifestDiscovery{
				ready: make(chan struct{}),
				items: []appmanifestv1alpha2.AppManifest{discovered},
			}
			opts := resource.SearchOptions{
				SearchFields:         resource.NewSearchFieldsRegistry(nil, nil, nil),
				EmbeddingConfig:      resource.NewEmbeddingConfigRegistry(),
				HybridSearchConfig:   resource.NewHybridSearchConfigRegistry(nil),
				GlobalSearchCoverage: resource.NewGlobalSearchCoverageRegistry(nil),
			}
			cfg := setting.NewCfg()
			cfg.Logger = log.NewNopLogger()
			cfg.ProvisioningPath = root
			cfg.EnableEmbeddedAPIExtensions = tc.embedded
			require.NoError(t, configureInProcessManifests(t.Context(), cfg, opts, discovery, nil))

			widget := schema.GroupVersionResource{Group: "custom.ext.grafana.app", Version: "v1", Resource: "widgets"}
			widgetKey := resource.NewLowerGroupResource(widget.Group, widget.Resource)
			_, initialHash, initialProvider := opts.SearchFields.For(widgetKey)
			if tc.embedded {
				require.NotEmpty(t, initialHash)
				require.NotNil(t, initialProvider)
				require.Equal(t, "provisioned", initialProvider.Fields(widget)[0].Name)
			} else {
				require.Nil(t, initialProvider)
			}

			close(discovery.ready)
			discoveredGVR := widget
			discoveredGVR.Resource = strings.ToLower(tc.discovered) + "s"
			require.Eventually(t, func() bool {
				_, _, provider := opts.SearchFields.For(resource.NewLowerGroupResource(discoveredGVR.Group, discoveredGVR.Resource))
				return provider != nil && len(provider.Fields(discoveredGVR)) == 1 && provider.Fields(discoveredGVR)[0].Name == "discovered"
			}, 5*time.Second, 10*time.Millisecond)

			_, hash, provider := opts.SearchFields.For(widgetKey)
			config, found := opts.EmbeddingConfig.For(widget)
			if tc.wantField == "" {
				require.Nil(t, provider)
				require.False(t, found)
			} else {
				require.NotNil(t, provider)
				require.Len(t, provider.Fields(widget), 1)
				require.Equal(t, tc.wantField, provider.Fields(widget)[0].Name)
				require.True(t, found)
				require.Equal(t, resource.EmbeddingConfig{
					ReembedVersion: tc.wantRevision,
					Fields:         []app.ManifestVersionKindEmbedField{{Name: tc.wantField, Path: "spec." + tc.wantField}},
				}, config)
				if tc.discovered != "Widget" {
					require.Equal(t, initialHash, hash)
				}
			}
			require.Equal(t, tc.wantEnabled, opts.GlobalSearchCoverage.Covers(widget.GroupResource()))
			require.Equal(t, tc.wantEnabled, opts.HybridSearchConfig.Enabled(widget.Group, widget.Resource))
		})
	}
}

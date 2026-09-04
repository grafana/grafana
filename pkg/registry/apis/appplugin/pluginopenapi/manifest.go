package pluginopenapi

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

// pluginJSONFile sits beside the manifest in a built plugin.
const pluginJSONFile = "plugin.json"

// LoadManifest reads an app-sdk manifest file into the definition the spec is
// rendered from.
//
// A plugin's APIs are served under the group its manifest declares, but the
// settings API is described by the plugin's own metadata and schema. So when a
// plugin.json sits in the same directory -- which is what a built plugin looks
// like -- it is loaded too, and the spec then matches what a server serving that
// plugin would return. Without it the manifest's app name stands in for the
// plugin id, and the settings API falls back to its defaults.
func LoadManifest(ctx context.Context, path string) (definition.PluginDefinition, error) {
	var plugin definition.PluginDefinition

	raw, err := os.ReadFile(path) // #nosec G304 -- a path the operator typed
	if err != nil {
		return plugin, err
	}
	manifest, err := definition.ParseManifest(raw)
	if err != nil {
		return plugin, fmt.Errorf("%s: %w", filepath.Base(path), err)
	}
	if manifest == nil {
		return plugin, fmt.Errorf("%s: no manifest found", filepath.Base(path))
	}

	dir := filepath.Dir(path)
	if _, err := os.Stat(filepath.Join(dir, pluginJSONFile)); err == nil {
		plugin, err = loadPluginDir(ctx, dir)
		if err != nil {
			return plugin, err
		}
	}
	if plugin.JSONData.ID == "" {
		if manifest.AppName == "" {
			return plugin, fmt.Errorf("%s: manifest has no appName, and there is no %s to take a plugin id from",
				filepath.Base(path), pluginJSONFile)
		}
		plugin.JSONData = plugins.JSONData{
			ID:   manifest.AppName,
			Type: plugins.TypeApp,
		}
	}

	// The file the caller named wins over the one the directory happens to hold.
	plugin.Manifest = manifest
	return plugin, nil
}

// loadPluginDir reads a built plugin the way the server reads it, so the
// definition carries the same plugin.json, schemas and manifest.
func loadPluginDir(ctx context.Context, dir string) (definition.PluginDefinition, error) {
	found, err := definition.LoadPluginDefinition(ctx,
		singleSource{sources.NewUnsafeLocalSource(plugins.ClassExternal, []string{dir})},
		definition.Options{Schemas: true, AppManifest: true},
	)
	if err != nil {
		return definition.PluginDefinition{}, err
	}
	if len(found) == 0 {
		// The directory holds a plugin.json the loader would not take, which
		// says more than a spec rendered from defaults would.
		return definition.PluginDefinition{}, fmt.Errorf("%s in %s could not be loaded", pluginJSONFile, dir)
	}
	return found[0], nil
}

// singleSource adapts one plugin source to the registry the loader takes.
type singleSource struct {
	source plugins.PluginSource
}

func (s singleSource) List(_ context.Context) []plugins.PluginSource {
	return []plugins.PluginSource{s.source}
}

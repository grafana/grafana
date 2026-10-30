package definition

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestV1alpha1 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha1"
	appmanifestV1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

// appSDKManifestFile is the statically-named file, read from the root of an app plugin's
// bundle, that holds the plugin's app-sdk manifest (an AppManifest custom resource).
const appSDKManifestFile = "app-sdk-manifest.json"

type Options struct {
	// Limit which plugins we are looking for
	Filter func(plugins.JSONData) bool

	// Load the experimental schema structures
	// NOTE: these will eventually be represented in something like AppManifest
	Schemas bool

	// Load an app manifest file
	AppManifest bool
}

func LoadPluginDefinition(ctx context.Context, pluginSources sources.Registry, opts Options) ([]PluginDefinition, error) {
	c := newCollector(opts)

	for _, pluginSource := range pluginSources.List(ctx) {
		res, err := pluginSource.Discover(ctx)
		if err != nil {
			return nil, err
		}
		for _, p := range res {
			if err := c.add(p.Primary.FS, p.Primary.JSONData); err != nil {
				return nil, err
			}
			for _, child := range p.Children {
				if err := c.add(child.FS, child.JSONData); err != nil {
					return nil, err
				}
			}
		}
	}
	return c.pluginInfo, nil
}

// LoadedPlugin is a plugin that is already loaded, with the files to read its
// definition from.
type LoadedPlugin struct {
	FS       fs.FS
	JSONData plugins.JSONData
}

// LoadPluginDefinitionFromPlugins reads the definitions of plugins that are
// already loaded, such as those in the plugin store, instead of discovering
// them from a source. Children must be listed as plugins of their own, as the
// store does.
func LoadPluginDefinitionFromPlugins(loaded []LoadedPlugin, opts Options) ([]PluginDefinition, error) {
	c := newCollector(opts)
	for _, p := range loaded {
		if p.FS == nil {
			continue
		}
		if err := c.add(p.FS, p.JSONData); err != nil {
			return nil, err
		}
	}
	return c.pluginInfo, nil
}

type collector struct {
	opts       Options
	pluginInfo []PluginDefinition
	// It's possible that the same plugin will be found more than once.
	// Registering the same plugin twice in the API is Probably A Bad Thing,
	// so this keeps track of uniques, so we can skip duplicates.
	uniquePlugins map[string]bool
}

func newCollector(opts Options) *collector {
	if opts.Filter == nil {
		// Keep all plugins
		opts.Filter = func(j plugins.JSONData) bool { return true }
	}
	return &collector{opts: opts, uniquePlugins: map[string]bool{}}
}

func (c *collector) add(rootfs fs.FS, jsondata plugins.JSONData) error {
	if !c.opts.Filter(jsondata) {
		return nil
	}
	if c.uniquePlugins[jsondata.ID] {
		backend.Logger.Info("Found duplicate plugin when registering API groups", "pluginId", jsondata.ID)
		return nil
	}
	info, err := loadInfo(rootfs, jsondata, c.opts)
	if err != nil {
		return err
	}
	c.uniquePlugins[jsondata.ID] = true
	c.pluginInfo = append(c.pluginInfo, info)
	return nil
}

func loadInfo(rootfs fs.FS, jsondata plugins.JSONData, opts Options) (PluginDefinition, error) {
	info := PluginDefinition{
		JSONData: jsondata,
	}

	if opts.AppManifest {
		m, err := LoadManifest(rootfs)
		if err != nil {
			// A malformed manifest must not take down every other plugin's API:
			// this runs during server startup via DI, so serve the plugin
			// without its manifest kinds instead of failing the whole load.
			backend.Logger.Error("Skipping invalid app-sdk manifest", "pluginId", jsondata.ID, "error", err)
		} else if m != nil {
			info.Manifests = append(info.Manifests, m)
		}
	}

	if !opts.Schemas {
		return info, nil
	}

	fss, err := fs.Sub(rootfs, "schema")
	if err != nil {
		return info, fmt.Errorf("error accessing plugin fs %s: %w", jsondata.ID, err)
	}

	p := pluginschema.NewSchemaProvider(fss)
	schema, err := p.Get("v0alpha1")
	if err != nil {
		return info, fmt.Errorf("error loading schema %s: %w", jsondata.ID, err)
	}
	if !schema.IsZero() {
		info.Schemas = map[string]*pluginschema.PluginSchema{
			"v0alpha1": schema,
		}
	}
	return info, nil
}

// LoadManifest returns the app-sdk manifest a plugin ships at the root of its
// files as app-sdk-manifest.json, or nil if it has none.
func LoadManifest(rootfs fs.FS) (*app.ManifestData, error) {
	f, err := rootfs.Open(appSDKManifestFile)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("opening %s: %w", appSDKManifestFile, err)
	}
	defer f.Close() //nolint:errcheck

	raw, err := io.ReadAll(f)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", appSDKManifestFile, err)
	}

	manifest, err := ParseManifest(raw)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", appSDKManifestFile, err)
	}
	return manifest, nil
}

// ParseManifest decodes the app-sdk AppManifest a plugin ships as
// app-sdk-manifest.json.
//
// The schema differs between versions (v1alpha1 kinds carry "schema", v1alpha2
// carries "schemas") and json decoding would silently drop the mismatched
// field, so dispatch on the declared apiVersion and reject anything we cannot
// faithfully decode -- including a manifest that declares no apiVersion.
func ParseManifest(raw []byte) (*app.ManifestData, error) {
	var meta struct {
		APIVersion string `json:"apiVersion"`
	}
	if err := json.Unmarshal(raw, &meta); err != nil {
		return nil, fmt.Errorf("decoding AppManifest CR: %w", err)
	}

	var manifest app.ManifestData
	var err error
	switch meta.APIVersion {
	case "apps.grafana.app/v1alpha2":
		var cr appmanifestV1alpha2.AppManifest
		if err := json.Unmarshal(raw, &cr); err != nil {
			return nil, fmt.Errorf("decoding AppManifest CR (%s): %w", meta.APIVersion, err)
		}
		manifest, err = cr.Spec.ToManifestData()
	case "apps.grafana.app/v1alpha1":
		var cr appmanifestV1alpha1.AppManifest
		if err := json.Unmarshal(raw, &cr); err != nil {
			return nil, fmt.Errorf("decoding AppManifest CR (%s): %w", meta.APIVersion, err)
		}
		manifest, err = cr.Spec.ToManifestData()
	default:
		return nil, fmt.Errorf("unsupported AppManifest apiVersion %q", meta.APIVersion)
	}
	if err != nil {
		return nil, fmt.Errorf("converting AppManifestSpec to ManifestData: %w", err)
	}
	MigrateDeprecatedRoutes(&manifest)
	return &manifest, nil
}

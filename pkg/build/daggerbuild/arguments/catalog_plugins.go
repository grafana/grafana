package arguments

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

// CatalogPluginSpec defines a plugin to download from the Grafana catalog.
type CatalogPluginSpec struct {
	ID       string `json:"id"`
	Version  string `json:"version"`
	Checksum string `json:"checksum,omitempty"` // Optional SHA256 checksum for verification
}

// CatalogPluginsManifest is the JSON structure for the manifest file.
type CatalogPluginsManifest struct {
	Plugins []CatalogPluginSpec `json:"plugins"`
}

var flagBundleCatalogPlugins = &cli.StringSliceFlag{
	Name:  "bundle-catalog-plugins",
	Usage: "Plugins to download from grafana.com catalog (format: id or id:version, version optional). Supports comma-separated and repeated flags.",
}

var flagBundleCatalogPluginsFile = &cli.StringFlag{
	Name:  "bundle-catalog-plugins-file",
	Usage: "Path to JSON manifest file containing catalog plugins to bundle",
}

var CatalogPluginsFlags = []cli.Flag{
	flagBundleCatalogPlugins,
	flagBundleCatalogPluginsFile,
}

// CatalogPlugins is the argument that provides the list of catalog plugins to bundle.
var CatalogPlugins = pipeline.Argument{
	Name:        "catalog-plugins",
	Description: "List of plugins to download from the Grafana catalog",
	Flags:       CatalogPluginsFlags,
	ValueFunc:   catalogPluginsValueFunc,
}

func catalogPluginsValueFunc(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
	// StringSlice handles both comma-separated and repeated flags
	pluginsList := opts.CLIContext.StringSlice("bundle-catalog-plugins")
	manifestFile := opts.CLIContext.String("bundle-catalog-plugins-file")

	var plugins []CatalogPluginSpec

	// Parse plugin specs from CLI flags
	for _, item := range pluginsList {
		parsed, err := ParseCatalogPluginsList(item)
		if err != nil {
			return nil, fmt.Errorf("failed to parse --bundle-catalog-plugins: %w", err)
		}
		plugins = append(plugins, parsed...)
	}

	// Parse manifest file if provided
	if manifestFile != "" {
		parsed, err := ParseCatalogPluginsFile(manifestFile)
		if err != nil {
			return nil, fmt.Errorf("failed to parse --bundle-catalog-plugins-file: %w", err)
		}
		plugins = append(plugins, parsed...)
	}

	merged, err := MergeCatalogPluginSpecs(plugins)
	if err != nil {
		return nil, err
	}

	return merged, nil
}

// ParseCatalogPluginsList parses a comma-separated list of plugins.
// Format: "id" or "id:version" - version is optional and will resolve to latest compatible if omitted.
func ParseCatalogPluginsList(list string) ([]CatalogPluginSpec, error) {
	if list == "" {
		return nil, nil
	}

	items := strings.Split(list, ",")
	plugins := make([]CatalogPluginSpec, 0, len(items))

	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}

		parts := strings.SplitN(item, ":", 2)
		id := strings.TrimSpace(parts[0])
		if id == "" {
			return nil, fmt.Errorf("invalid plugin format %q, id cannot be empty", item)
		}

		version := ""
		if len(parts) == 2 {
			version = strings.TrimSpace(parts[1])
		}

		plugins = append(plugins, CatalogPluginSpec{
			ID:      id,
			Version: version,
		})
	}

	return plugins, nil
}

// ParseCatalogPluginsFile parses a JSON manifest file containing plugins to bundle.
func ParseCatalogPluginsFile(path string) ([]CatalogPluginSpec, error) {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest file: %w", err)
	}

	var manifest CatalogPluginsManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse manifest JSON: %w", err)
	}

	// Validate all plugins have required fields
	// Version is optional - empty version means "latest compatible"
	for i, plugin := range manifest.Plugins {
		if plugin.ID == "" {
			return nil, fmt.Errorf("plugin at index %d is missing required 'id' field", i)
		}
	}

	return manifest.Plugins, nil
}

// HasCatalogPlugins returns true if any catalog plugins were specified via CLI flags.
func HasCatalogPlugins(ctx context.Context, opts *pipeline.ArgumentOpts) bool {
	pluginsList := opts.CLIContext.StringSlice("bundle-catalog-plugins")
	manifestFile := opts.CLIContext.String("bundle-catalog-plugins-file")
	return len(pluginsList) > 0 || manifestFile != ""
}

// GetCatalogPlugins retrieves the catalog plugins from the argument state.
func GetCatalogPlugins(ctx context.Context, state pipeline.StateHandler) ([]CatalogPluginSpec, error) {
	v, ok := pipeline.UnwrapState(state)
	if !ok {
		return nil, fmt.Errorf("state is not backed by *pipeline.State (got %T)", state)
	}

	if val, ok := v.Data.Load(CatalogPlugins.Name); ok {
		plugins, ok := val.([]CatalogPluginSpec)
		if !ok {
			return nil, fmt.Errorf("unexpected type for catalog plugins")
		}
		return plugins, nil
	}

	// If not in state, compute it
	opts := v.ArgumentOpts()
	result, err := catalogPluginsValueFunc(ctx, opts)
	if err != nil {
		return nil, err
	}

	plugins := result.([]CatalogPluginSpec)
	v.Data.Store(CatalogPlugins.Name, plugins)
	return plugins, nil
}

// MergeCatalogPluginSpecs deduplicates plugin specs by id and rejects conflicts.
// If the same plugin appears multiple times with identical version/checksum, it is collapsed into one entry.
func MergeCatalogPluginSpecs(plugins []CatalogPluginSpec) ([]CatalogPluginSpec, error) {
	if len(plugins) == 0 {
		return nil, nil
	}

	seen := make(map[string]int, len(plugins))
	merged := make([]CatalogPluginSpec, 0, len(plugins))

	for _, plugin := range plugins {
		idx, ok := seen[plugin.ID]
		if !ok {
			seen[plugin.ID] = len(merged)
			merged = append(merged, plugin)
			continue
		}

		existing := merged[idx]
		if existing.Version != plugin.Version {
			return nil, fmt.Errorf("conflicting versions for plugin %q: %q vs %q", plugin.ID, existing.Version, plugin.Version)
		}

		switch {
		case existing.Checksum == plugin.Checksum:
			// Identical duplicate, no-op.
		case existing.Checksum == "":
			existing.Checksum = plugin.Checksum
			merged[idx] = existing
		case plugin.Checksum == "":
			// Keep existing checksum.
		default:
			return nil, fmt.Errorf("conflicting checksums for plugin %q", plugin.ID)
		}
	}

	return merged, nil
}

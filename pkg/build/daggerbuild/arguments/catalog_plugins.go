package arguments

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
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

var flagBundleCatalogPlugins = &cli.StringFlag{
	Name:  "bundle-catalog-plugins",
	Usage: "Comma-separated list of plugins to download from grafana.com catalog (format: id:version,id:version)",
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
	// First check for CLI flag with comma-separated list
	pluginsList := opts.CLIContext.String("bundle-catalog-plugins")
	manifestFile := opts.CLIContext.String("bundle-catalog-plugins-file")

	var plugins []CatalogPluginSpec

	// Parse comma-separated list if provided
	if pluginsList != "" {
		parsed, err := ParseCatalogPluginsList(pluginsList)
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

	return plugins, nil
}

// ParseCatalogPluginsList parses a comma-separated list of plugins in the format "id:version,id:version".
func ParseCatalogPluginsList(list string) ([]CatalogPluginSpec, error) {
	if list == "" {
		return nil, nil
	}

	var plugins []CatalogPluginSpec
	items := strings.Split(list, ",")

	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}

		parts := strings.SplitN(item, ":", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid plugin format %q, expected id:version", item)
		}

		id := strings.TrimSpace(parts[0])
		version := strings.TrimSpace(parts[1])

		if id == "" || version == "" {
			return nil, fmt.Errorf("invalid plugin format %q, id and version cannot be empty", item)
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
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest file: %w", err)
	}

	var manifest CatalogPluginsManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse manifest JSON: %w", err)
	}

	// Validate all plugins have required fields
	for i, plugin := range manifest.Plugins {
		if plugin.ID == "" {
			return nil, fmt.Errorf("plugin at index %d is missing required 'id' field", i)
		}
		if plugin.Version == "" {
			return nil, fmt.Errorf("plugin %q is missing required 'version' field", plugin.ID)
		}
	}

	return manifest.Plugins, nil
}

// HasCatalogPlugins returns true if any catalog plugins were specified via CLI flags.
func HasCatalogPlugins(ctx context.Context, opts *pipeline.ArgumentOpts) bool {
	pluginsList := opts.CLIContext.String("bundle-catalog-plugins")
	manifestFile := opts.CLIContext.String("bundle-catalog-plugins-file")
	return pluginsList != "" || manifestFile != ""
}

// GetCatalogPlugins retrieves the catalog plugins from the argument state.
func GetCatalogPlugins(ctx context.Context, state pipeline.StateHandler) ([]CatalogPluginSpec, error) {
	v, ok := state.(*pipeline.State)
	if !ok {
		return nil, fmt.Errorf("state is not a *pipeline.State")
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

package artifacts

import (
	"context"
	"fmt"
	"log/slog"
	"path"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/grafana/grafana/pkg/build/daggerbuild/plugins"
)

var (
	CatalogPluginsFlags     = flags.JoinFlags(flags.PackageNameFlags, flags.DistroFlags())
	CatalogPluginsArguments = []pipeline.Argument{
		arguments.CatalogPlugins,
		arguments.Version, // Used for compatibility headers when downloading plugins
	}
)

var CatalogPluginsInitializer = Initializer{
	InitializerFunc: NewCatalogPluginsFromString,
	Arguments:       CatalogPluginsArguments,
}

// CatalogPlugins downloads plugins from the Grafana catalog (grafana.com).
type CatalogPlugins struct {
	// ResolvedPlugins contains plugins with resolved versions (after calling ResolvePluginVersions)
	ResolvedPlugins []plugins.ResolvedPlugin
	Distribution    backend.Distribution
	GrafanaVersion  string // Optional: used for API compatibility headers
}

// Dependencies returns nil as catalog plugins have no dependencies.
func (c *CatalogPlugins) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

// Builder creates the container that will download the plugins.
func (c *CatalogPlugins) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return opts.Client.Container().From(plugins.AlpineImage).
		WithExec([]string{"apk", "add", "--no-cache", "curl", "unzip"}), nil
}

// BuildFile is not implemented as CatalogPlugins returns a directory.
func (c *CatalogPlugins) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	panic("not implemented") // CatalogPlugins doesn't return a file
}

// BuildDir downloads the plugins and returns a directory containing them.
func (c *CatalogPlugins) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return plugins.DownloadPlugins(opts.Client, &plugins.DownloadOpts{
		Distribution:   c.Distribution,
		GrafanaVersion: c.GrafanaVersion,
	}, c.ResolvedPlugins), nil
}

// Publisher is not implemented.
func (c *CatalogPlugins) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return nil, nil
}

// PublishFile is not implemented.
func (c *CatalogPlugins) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented")
}

// PublishDir is not implemented.
func (c *CatalogPlugins) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	return nil
}

// VerifyFile is not implemented as CatalogPlugins returns a directory.
func (c *CatalogPlugins) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
}

// VerifyDirectory verifies the downloaded plugins directory.
func (c *CatalogPlugins) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	entries, err := dir.Entries(ctx)
	if err != nil {
		return fmt.Errorf("failed to list plugin directory entries: %w", err)
	}
	entrySet := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		entrySet[entry] = struct{}{}
	}

	// Verify that each expected plugin directory exists
	for _, plugin := range c.ResolvedPlugins {
		if _, ok := entrySet[plugin.ID]; !ok {
			return fmt.Errorf("plugin %s not found in downloaded plugins", plugin.ID)
		}
	}
	return nil
}

// String returns the name of this artifact handler.
func (c *CatalogPlugins) String() string {
	return "catalog-plugins"
}

// Filename returns a deterministic path for caching purposes.
func (c *CatalogPlugins) Filename(ctx context.Context) (string, error) {
	// Create a unique filename based on plugins and distribution
	pluginIDs := make([]string, 0, len(c.ResolvedPlugins))
	for _, p := range c.ResolvedPlugins {
		pluginIDs = append(pluginIDs, fmt.Sprintf("%s-%s", p.ID, p.Version))
	}

	os, arch := backend.OSAndArch(c.Distribution)
	return path.Join("bin", "catalog-plugins", os, arch, strings.Join(pluginIDs, "_")), nil
}

// NewCatalogPluginsFromString creates a CatalogPlugins artifact from an artifact string.
func NewCatalogPluginsFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	options, err := pipeline.ParseFlags(artifact, CatalogPluginsFlags)
	if err != nil {
		return nil, err
	}

	distro, err := options.String(flags.Distribution)
	if err != nil {
		return nil, err
	}

	pluginSpecs, err := arguments.GetCatalogPlugins(ctx, state)
	if err != nil {
		return nil, err
	}

	// Get Grafana version for API compatibility headers (optional, may fail if not available)
	version, _ := state.String(ctx, arguments.Version)

	if len(pluginSpecs) == 0 {
		log.Info("No catalog plugins specified, returning empty artifact")
	} else {
		log.Info("Creating catalog plugins artifact", "plugins", len(pluginSpecs), "distribution", distro, "grafanaVersion", version)
	}

	return NewCatalogPlugins(ctx, log, artifact, pluginSpecs, backend.Distribution(distro), version)
}

// NewCatalogPlugins creates a new CatalogPlugins artifact.
// This resolves plugin versions for plugins that don't have a specific version specified.
func NewCatalogPlugins(
	ctx context.Context,
	log *slog.Logger,
	artifact string,
	pluginSpecs []arguments.CatalogPluginSpec,
	distro backend.Distribution,
	grafanaVersion string,
) (*pipeline.Artifact, error) {
	// Resolve versions for plugins that don't have a specific version specified
	resolvedPlugins, err := plugins.ResolvePluginVersions(ctx, log, pluginSpecs, grafanaVersion, distro)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve plugin versions: %w", err)
	}

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          CatalogPluginsFlags,
		Handler: &CatalogPlugins{
			ResolvedPlugins: resolvedPlugins,
			Distribution:    distro,
			GrafanaVersion:  grafanaVersion,
		},
	})
}

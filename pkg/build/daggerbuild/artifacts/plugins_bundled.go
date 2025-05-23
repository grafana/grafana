package artifacts

import (
	"context"
	"log/slog"
	"path"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	BundledPluginsFlags     = flags.PackageNameFlags
	BundledPluginsArguments = []pipeline.Argument{
		arguments.YarnCacheDirectory,
	}
)

type BundledPlugins struct {
	Name      packages.Name
	Src       *dagger.Directory
	YarnCache *dagger.CacheVolume
	Version   string
}

// The frontend does not have any artifact dependencies.
func (f *BundledPlugins) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

// Builder will return a node.js alpine container that matches the .nvmrc in the Grafana source repository
func (f *BundledPlugins) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return FrontendBuilder(ctx, f.Src, f.YarnCache, opts)
}

func (f *BundledPlugins) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	panic("not implemented") // BundledPlugins doesn't return a file
}

func (f *BundledPlugins) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return frontend.BuildPlugins(builder), nil
}

func (f *BundledPlugins) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return nil, nil
}

func (f *BundledPlugins) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *BundledPlugins) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	return nil
}

func (f *BundledPlugins) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
}

func (f *BundledPlugins) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (f *BundledPlugins) Filename(ctx context.Context) (string, error) {
	// Important note: this path is only used in two ways:
	// 1. When requesting an artifact be built and exported, this is the path where it will be exported to
	// 2. In a map to distinguish when the same artifact is being built more than once
	return path.Join("bin", "bundled-plugins"), nil
}

func NewBundledPlugins(ctx context.Context, log *slog.Logger, artifact string, src *dagger.Directory, version string, cacheVolume *dagger.CacheVolume) (*pipeline.Artifact, error) {
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          BundledPluginsFlags,
		Handler: &BundledPlugins{
			Src:       src,
			YarnCache: cacheVolume,
			Version:   version,
		},
	})
}

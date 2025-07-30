package artifacts

import (
	"context"
	"log/slog"
	"path/filepath"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	NPMPackagesFlags     = flags.PackageNameFlags
	NPMPackagesArguments = []pipeline.Argument{
		arguments.YarnCacheDirectory,
	}
)

var NPMPackagesInitializer = Initializer{
	InitializerFunc: NewNPMPackagesFromString,
	Arguments:       NPMPackagesArguments,
}

type NPMPackages struct {
	Src       *dagger.Directory
	YarnCache *dagger.CacheVolume
	Version   string
}

// The frontend does not have any artifact dependencies.
func (f *NPMPackages) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

// Builder will return a node.js alpine container that matches the .nvmrc in the Grafana source repository
func (f *NPMPackages) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return FrontendBuilder(ctx, f.Src, f.YarnCache, opts)
}

func (f *NPMPackages) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	panic("not implemented") // NPMPackages doesn't return a file
}

func (f *NPMPackages) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return frontend.NPMPackages(builder, opts.Client, opts.Log, f.Src, strings.TrimPrefix(f.Version, "v"))
}

func (f *NPMPackages) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (f *NPMPackages) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *NPMPackages) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *NPMPackages) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Not a file
	return nil
}

func (f *NPMPackages) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	// Nothing to verify (yet?)
	return nil
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (f *NPMPackages) Filename(ctx context.Context) (string, error) {
	// Important note: this path is only used in two ways:
	// 1. When requesting an artifact be built and exported, this is the path where it will be exported to
	// 2. In a map to distinguish when the same artifact is being built more than once
	return filepath.Join(f.Version, "npm-artifacts"), nil
}

func NewNPMPackagesFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	grafanaDir, err := GrafanaDir(ctx, state, false)
	if err != nil {
		return nil, err
	}
	cache, err := state.CacheVolume(ctx, arguments.YarnCacheDirectory)
	if err != nil {
		return nil, err
	}
	version, err := state.String(ctx, arguments.Version)
	if err != nil {
		return nil, err
	}

	return NewNPMPackages(ctx, log, artifact, grafanaDir, version, cache)
}

func NewNPMPackages(ctx context.Context, log *slog.Logger, artifact string, src *dagger.Directory, version string, cache *dagger.CacheVolume) (*pipeline.Artifact, error) {
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          NPMPackagesFlags,
		Handler: &NPMPackages{
			Src:       src,
			YarnCache: cache,
			Version:   version,
		},
	})
}

package artifacts

import (
	"context"
	"log/slog"
	"path/filepath"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	StorybookFlags     = flags.PackageNameFlags
	StorybookArguments = []pipeline.Argument{
		arguments.YarnCacheDirectory,
	}
)

var StorybookInitializer = Initializer{
	InitializerFunc: NewStorybookFromString,
	Arguments:       StorybookArguments,
}

type Storybook struct {
	Src       *dagger.Directory
	YarnCache *dagger.CacheVolume
	Version   string
}

// The frontend does not have any artifact dependencies.
func (f *Storybook) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

// Builder will return a node.js alpine container that matches the .nvmrc in the Grafana source repository
func (f *Storybook) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return FrontendBuilder(ctx, f.Src, f.YarnCache, opts)
}

func (f *Storybook) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	// Not a file
	return nil, nil
}

func (f *Storybook) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return frontend.Storybook(builder, f.Src, f.Version), nil
}

func (f *Storybook) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (f *Storybook) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *Storybook) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *Storybook) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Not a file
	return nil
}

func (f *Storybook) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	return nil
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (f *Storybook) Filename(ctx context.Context) (string, error) {
	// Important note: this path is only used in two ways:
	// 1. When requesting an artifact be built and exported, this is the path where it will be exported to
	// 2. In a map to distinguish when the same artifact is being built more than once
	return filepath.Join(f.Version, "storybook"), nil
}

func NewStorybookFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	grafanaDir, err := GrafanaDir(ctx, state, false)
	if err != nil {
		return nil, err
	}
	cacheDir, err := state.CacheVolume(ctx, arguments.YarnCacheDirectory)
	if err != nil {
		return nil, err
	}
	version, err := state.String(ctx, arguments.Version)
	if err != nil {
		return nil, err
	}

	return NewStorybook(ctx, log, artifact, grafanaDir, version, cacheDir)
}

func NewStorybook(ctx context.Context, log *slog.Logger, artifact string, src *dagger.Directory, version string, cache *dagger.CacheVolume) (*pipeline.Artifact, error) {
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          StorybookFlags,
		Handler: &Storybook{
			Src:       src,
			YarnCache: cache,
			Version:   version,
		},
	})
}

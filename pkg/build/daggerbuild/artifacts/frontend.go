package artifacts

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	FrontendFlags     = flags.PackageNameFlags
	FrontendArguments = []pipeline.Argument{
		arguments.YarnCacheDirectory,
	}
)

var FrontendInitializer = Initializer{
	InitializerFunc: NewFrontendFromString,
	Arguments:       FrontendArguments,
}

type Frontend struct {
	Enterprise bool
	Version    string
	Src        *dagger.Directory
	YarnCache  *dagger.CacheVolume
}

// The frontend does not have any artifact dependencies.
func (f *Frontend) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

// Builder will return a node.js alpine container that matches the .nvmrc in the Grafana source repository
func (f *Frontend) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return FrontendBuilder(ctx, f.Src, f.YarnCache, opts)
}

func (f *Frontend) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	panic("not implemented") // Frontend doesn't return a file
}

func (f *Frontend) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return frontend.Build(builder, f.Version), nil
}

func (f *Frontend) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (f *Frontend) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *Frontend) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (f *Frontend) Filename(ctx context.Context) (string, error) {
	n := "grafana"
	if f.Enterprise {
		n = "grafana-enterprise"
	}

	// Important note: this path is only used in two ways:
	// 1. When requesting an artifact be built and exported, this is the path where it will be exported to
	// 2. In a map to distinguish when the same artifact is being built more than once
	return filepath.Join(f.Version, n, "public"), nil
}

func (f *Frontend) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Should never be called since this isn't a File.
	return nil
}

func (f *Frontend) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	// Nothing to do to verify these (for now?)
	return nil
}

func NewFrontendFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	options, err := pipeline.ParseFlags(artifact, FrontendFlags)
	if err != nil {
		return nil, err
	}

	enterprise, err := options.Bool(flags.Enterprise)
	if err != nil {
		return nil, err
	}

	src, err := GrafanaDir(ctx, state, enterprise)
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

	return NewFrontend(ctx, log, artifact, version, enterprise, src, cache)
}

func NewFrontend(ctx context.Context, log *slog.Logger, artifact, version string, enterprise bool, src *dagger.Directory, cache *dagger.CacheVolume) (*pipeline.Artifact, error) {
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          FrontendFlags,
		Handler: &Frontend{
			Enterprise: enterprise,
			Version:    version,
			Src:        src,
			YarnCache:  cache,
		},
	})
}

func FrontendBuilder(
	ctx context.Context,
	src *dagger.Directory,
	cache *dagger.CacheVolume,
	opts *pipeline.ArtifactContainerOpts,
) (*dagger.Container, error) {
	nodeVersion, err := frontend.NodeVersion(opts.Client, src).Stdout(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get node version from source code: %w", err)
	}

	return frontend.Builder(opts.Client, opts.Platform, src, nodeVersion, cache), nil
}

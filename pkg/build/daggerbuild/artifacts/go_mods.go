package artifacts

import (
	"context"
	"log/slog"
	"path/filepath"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/golang"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	GoModDirFlags     = flags.PackageNameFlags
	GoModDirArguments = []pipeline.Argument{
		arguments.YarnCacheDirectory,
	}
)

var GoModDirInitializer = Initializer{
	InitializerFunc: NewGoModDirFromString,
	Arguments:       GoModDirArguments,
}

type GoModDir struct {
	Src       *dagger.Directory
	Cache     *dagger.CacheVolume
	GoVersion string
	Version   string
}

// The frontend does not have any artifact dependencies.
func (f *GoModDir) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

func (f *GoModDir) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	goVersion, err := opts.State.String(ctx, arguments.GoVersion)
	if err != nil {
		return nil, err
	}
	return golang.Container(opts.Client, opts.Platform, goVersion).
		WithEnvVariable("GOMODCACHE", "/go/pkg/mod"), nil
}

func (f *GoModDir) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	panic("not implemented") // GoModDir doesn't return a file
}

func (f *GoModDir) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return builder.
		WithDirectory("/src", f.Src, dagger.ContainerWithDirectoryOpts{
			Include: []string{"**/*.mod", "**/*.sum", "**/*.work"},
		}).
		WithWorkdir("/src").
		//WithMountedCache("/go/pkg/mod", f.Cache).
		WithExec([]string{"go", "mod", "download"}).
		Directory("/go/pkg/mod"), nil
}

func (f *GoModDir) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (f *GoModDir) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *GoModDir) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

func (f *GoModDir) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Not a file
	return nil
}

func (f *GoModDir) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	// Nothing to verify (yet?)
	return nil
}

func (f *GoModDir) String() string {
	return "go-modules"
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (f *GoModDir) Filename(ctx context.Context) (string, error) {
	// Important note: this path is only used in two ways:
	// 1. When requesting an artifact be built and exported, this is the path where it will be exported to
	// 2. In a map to distinguish when the same artifact is being built more than once
	return filepath.Join(f.Version, "go-modules"), nil
}

func NewGoModDirFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	grafanaDir, err := GrafanaDir(ctx, state, false)
	if err != nil {
		return nil, err
	}
	cache, err := state.CacheVolume(ctx, arguments.GoModCache)
	if err != nil {
		return nil, err
	}
	version, err := state.String(ctx, arguments.Version)
	if err != nil {
		return nil, err
	}

	return NewGoModDir(ctx, log, artifact, grafanaDir, version, cache)
}

func NewGoModDir(ctx context.Context, log *slog.Logger, artifact string, src *dagger.Directory, version string, cache *dagger.CacheVolume) (*pipeline.Artifact, error) {
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          GoModDirFlags,
		Handler: &GoModDir{
			Src:     src,
			Cache:   cache,
			Version: version,
		},
	})
}

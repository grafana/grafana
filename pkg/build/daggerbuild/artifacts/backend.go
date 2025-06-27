package artifacts

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	BackendArguments = []pipeline.Argument{
		arguments.GrafanaDirectory,
		arguments.EnterpriseDirectory,
		arguments.GoVersion,
		arguments.ViceroyVersion,
	}

	BackendFlags = flags.JoinFlags(
		flags.PackageNameFlags,
		flags.DistroFlags(),
	)
)

var BackendInitializer = Initializer{
	InitializerFunc: NewBackendFromString,
	Arguments:       BackendArguments,
}

type Backend struct {
	// Name allows different backend compilations to be different even if all other factors are the same.
	// For example, Grafana Enterprise, Grafana, and Grafana Pro may be built using the same options,
	// but are fundamentally different because of the source code of the binary.
	Name           packages.Name
	Src            *dagger.Directory
	Distribution   backend.Distribution
	BuildOpts      *backend.BuildOpts
	GoVersion      string
	ViceroyVersion string

	GoBuildCache *dagger.CacheVolume
	GoModCache   *dagger.CacheVolume
	// Version is embedded in the binary at build-time
	Version string
}

func (b *Backend) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return backend.Builder(
		opts.Client,
		opts.Log,
		b.Distribution,
		b.BuildOpts,
		opts.Platform,
		b.Src,
		b.GoVersion,
		b.ViceroyVersion,
		b.GoBuildCache,
		b.GoModCache,
	)
}

func (b *Backend) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return nil, nil
}

func (b *Backend) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	panic("not implemented") // TODO: Implement
}

func (b *Backend) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	f, err := b.Filename(ctx)
	if err != nil {
		return nil, err
	}

	return backend.Build(
		opts.Client,
		builder,
		b.Src,
		b.Distribution,
		f,
		b.BuildOpts,
	), nil
}

func (b *Backend) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (b *Backend) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (b *Backend) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (b *Backend) Filename(ctx context.Context) (string, error) {
	return filepath.Join("bin", string(b.Name), string(b.Distribution)), nil
}

func (b *Backend) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Not a file
	return nil
}

func (b *Backend) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	// Nothing to do (yet)
	return nil
}

type NewBackendOpts struct {
	Name           packages.Name
	Enterprise     bool
	Src            *dagger.Directory
	Distribution   backend.Distribution
	GoVersion      string
	ViceroyVersion string
	Version        string
	Experiments    []string
	Tags           []string
	Static         bool
	WireTag        string
	GoBuildCache   *dagger.CacheVolume
	GoModCache     *dagger.CacheVolume
}

func NewBackendFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	goVersion, err := state.String(ctx, arguments.GoVersion)
	if err != nil {
		return nil, err
	}
	viceroyVersion, err := state.String(ctx, arguments.ViceroyVersion)
	if err != nil {
		return nil, err
	}

	goModCache, err := state.CacheVolume(ctx, arguments.GoModCache)
	if err != nil {
		return nil, err
	}

	goBuildCache, err := state.CacheVolume(ctx, arguments.GoBuildCache)
	if err != nil {
		return nil, err
	}

	// 1. Figure out the options that were provided as part of the artifact string.
	//    For example, `linux/amd64:grafana`.
	options, err := pipeline.ParseFlags(artifact, TargzFlags)
	if err != nil {
		return nil, err
	}
	static, err := options.Bool(flags.Static)
	if err != nil {
		return nil, err
	}

	wireTag, err := options.String(flags.WireTag)
	if err != nil {
		return nil, err
	}

	experiments, err := options.StringSlice(flags.GoExperiments)
	if err != nil {
		return nil, err
	}

	tags, err := options.StringSlice(flags.GoTags)
	if err != nil {
		return nil, err
	}

	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}

	src, err := GrafanaDir(ctx, state, p.Enterprise)
	if err != nil {
		return nil, err
	}

	goCacheProg := ""
	// If the caller has GOCACHEPROG set, then reuse it
	if val, ok := os.LookupEnv("GOCACHEPROG"); ok {
		goCacheProg = val
	}

	bopts := &backend.BuildOpts{
		Version:           p.Version,
		Enterprise:        p.Enterprise,
		ExperimentalFlags: experiments,
		GoCacheProg:       goCacheProg,
		Static:            static,
		WireTag:           wireTag,
		Tags:              tags,
	}

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          BackendFlags,
		Handler: &Backend{
			Name:           p.Name,
			Distribution:   p.Distribution,
			BuildOpts:      bopts,
			GoVersion:      goVersion,
			ViceroyVersion: viceroyVersion,
			Src:            src,
			GoModCache:     goModCache,
			GoBuildCache:   goBuildCache,
		},
	})
}

func NewBackend(ctx context.Context, log *slog.Logger, artifact string, opts *NewBackendOpts) (*pipeline.Artifact, error) {
	bopts := &backend.BuildOpts{
		Version:           opts.Version,
		Enterprise:        opts.Enterprise,
		ExperimentalFlags: opts.Experiments,
		Tags:              opts.Tags,
		Static:            opts.Static,
		WireTag:           opts.WireTag,
	}

	log.Info("Initializing backend artifact with options", "static", opts.Static, "version", opts.Version, "name", opts.Name, "distro", opts.Distribution)
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeDirectory,
		Flags:          BackendFlags,
		Handler: &Backend{
			Name:           opts.Name,
			Distribution:   opts.Distribution,
			BuildOpts:      bopts,
			GoVersion:      opts.GoVersion,
			ViceroyVersion: opts.ViceroyVersion,
			Src:            opts.Src,
			GoModCache:     opts.GoModCache,
			GoBuildCache:   opts.GoBuildCache,
		},
	})
}

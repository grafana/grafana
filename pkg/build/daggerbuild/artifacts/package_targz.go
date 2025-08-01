package artifacts

import (
	"context"
	"fmt"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/e2e"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/grafana/grafana/pkg/build/daggerbuild/targz"
)

var (
	TargzArguments = []pipeline.Argument{
		// Tarballs need the Build ID and version for naming the package properly.
		arguments.BuildID,
		arguments.Version,

		// The grafanadirectory has contents like the LICENSE.txt and such that need to be included in the package
		arguments.GrafanaDirectory,

		// The go version used to build the backend
		arguments.GoVersion,
		arguments.ViceroyVersion,
		arguments.YarnCacheDirectory,
	}
	TargzFlags = flags.JoinFlags(
		flags.StdPackageFlags(),
	)
)

var TargzInitializer = Initializer{
	InitializerFunc: NewTarballFromString,
	Arguments:       TargzArguments,
}

type Tarball struct {
	Distribution backend.Distribution
	Name         packages.Name
	BuildID      string
	Version      string
	GoVersion    string
	Enterprise   bool

	Grafana   *dagger.Directory
	YarnCache *dagger.CacheVolume

	// Dependent artifacts
	Backend        *pipeline.Artifact
	Frontend       *pipeline.Artifact
	NPMPackages    *pipeline.Artifact
	BundledPlugins *pipeline.Artifact
	Storybook      *pipeline.Artifact
}

func NewTarballFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	goVersion, err := state.String(ctx, arguments.GoVersion)
	if err != nil {
		return nil, err
	}
	viceroyVersion, err := state.String(ctx, arguments.ViceroyVersion)
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

	tags, err := options.StringSlice(flags.GoTags)
	if err != nil {
		return nil, err
	}

	experiments, err := options.StringSlice(flags.GoExperiments)
	if err != nil {
		return nil, err
	}

	yarnCache, err := state.CacheVolume(ctx, arguments.YarnCacheDirectory)
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

	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}
	log.Info("Initializing tar.gz artifact with options", "name", p.Name, "build ID", p.BuildID, "version", p.Version, "distro", p.Distribution, "static", static, "enterprise", p.Enterprise)

	src, err := GrafanaDir(ctx, state, p.Enterprise)
	if err != nil {
		return nil, err
	}
	return NewTarball(ctx, log, artifact, p.Distribution, p.Enterprise, p.Name, p.Version, p.BuildID, src, yarnCache, goModCache, goBuildCache, static, wireTag, tags, goVersion, viceroyVersion, experiments)
}

// NewTarball returns a properly initialized Tarball artifact.
// There are a lot of options that can affect how a tarball is built; most of which define different ways for the backend to be built.
func NewTarball(
	ctx context.Context,
	log *slog.Logger,
	artifact string,
	distro backend.Distribution,
	enterprise bool,
	name packages.Name,
	version string,
	buildID string,
	src *dagger.Directory,
	cache *dagger.CacheVolume,
	goModCache *dagger.CacheVolume,
	goBuildCache *dagger.CacheVolume,
	static bool,
	wireTag string,
	tags []string,
	goVersion string,
	viceroyVersion string,
	experiments []string,
) (*pipeline.Artifact, error) {
	backendArtifact, err := NewBackend(ctx, log, artifact, &NewBackendOpts{
		Name:           name,
		Version:        version,
		Distribution:   distro,
		Src:            src,
		Static:         static,
		WireTag:        wireTag,
		Tags:           tags,
		GoVersion:      goVersion,
		ViceroyVersion: viceroyVersion,
		Experiments:    experiments,
		Enterprise:     enterprise,
		GoBuildCache:   goBuildCache,
		GoModCache:     goModCache,
	})
	if err != nil {
		return nil, err
	}
	frontendArtifact, err := NewFrontend(ctx, log, artifact, version, enterprise, src, cache)
	if err != nil {
		return nil, err
	}

	bundledPluginsArtifact, err := NewBundledPlugins(ctx, log, artifact, src, version, cache)
	if err != nil {
		return nil, err
	}

	npmArtifact, err := NewNPMPackages(ctx, log, artifact, src, version, cache)
	if err != nil {
		return nil, err
	}

	storybookArtifact, err := NewStorybook(ctx, log, artifact, src, version, cache)
	if err != nil {
		return nil, err
	}
	tarball := &Tarball{
		Name:         name,
		Distribution: distro,
		Version:      version,
		GoVersion:    goVersion,
		BuildID:      buildID,
		Grafana:      src,
		Enterprise:   enterprise,
		YarnCache:    cache,

		Backend:        backendArtifact,
		Frontend:       frontendArtifact,
		NPMPackages:    npmArtifact,
		BundledPlugins: bundledPluginsArtifact,
		Storybook:      storybookArtifact,
	}

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler:        tarball,
		Type:           pipeline.ArtifactTypeFile,
		Flags:          TargzFlags,
	})
}

func (t *Tarball) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	version := t.Version

	container := opts.Client.Container().
		From("alpine:3.18.4").
		WithExec([]string{"apk", "add", "--update", "tar"}).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf("echo %s > VERSION", version)})

	return container, nil
}

func (t *Tarball) BuildFile(ctx context.Context, b *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	var (
		state = opts.State
		log   = opts.Log
	)

	log.Debug("Getting grafana dir from state...")
	// The Grafana directory is used for other packaged data like Dockerfile, license.txt, etc.
	grafanaDir := t.Grafana

	backendDir, err := opts.Store.Directory(ctx, t.Backend)
	if err != nil {
		return nil, err
	}

	frontendDir, err := opts.Store.Directory(ctx, t.Frontend)
	if err != nil {
		return nil, err
	}

	npmDir, err := opts.Store.Directory(ctx, t.NPMPackages)
	if err != nil {
		return nil, err
	}

	storybookDir, err := opts.Store.Directory(ctx, t.Storybook)
	if err != nil {
		return nil, err
	}

	pluginsDir, err := opts.Store.Directory(ctx, t.BundledPlugins)
	if err != nil {
		return nil, err
	}

	version, err := state.String(ctx, arguments.Version)
	if err != nil {
		return nil, err
	}

	files := []targz.MappedFile{
		targz.NewMappedFile("VERSION", b.File("VERSION")),
		targz.NewMappedFile("LICENSE", grafanaDir.File("LICENSE")),
		targz.NewMappedFile("NOTICE.md", grafanaDir.File("NOTICE.md")),
		targz.NewMappedFile("README.md", grafanaDir.File("README.md")),
		targz.NewMappedFile("Dockerfile", grafanaDir.File("Dockerfile")),
		targz.NewMappedFile("tools/zoneinfo.zip", opts.Client.Container().From(fmt.Sprintf("golang:%s", t.GoVersion)).File("/usr/local/go/lib/time/zoneinfo.zip")),
	}

	directories := []targz.MappedDirectory{
		targz.NewMappedDir("conf", grafanaDir.Directory("conf")),
		targz.NewMappedDir("docs/sources", grafanaDir.Directory("docs/sources")),
		targz.NewMappedDir("packaging/deb", grafanaDir.Directory("packaging/deb")),
		targz.NewMappedDir("packaging/rpm", grafanaDir.Directory("packaging/rpm")),
		targz.NewMappedDir("packaging/docker", grafanaDir.Directory("packaging/docker")),
		targz.NewMappedDir("packaging/wrappers", grafanaDir.Directory("packaging/wrappers")),
		targz.NewMappedDir("bin", backendDir),
		targz.NewMappedDir("public", frontendDir),
		targz.NewMappedDir("npm-artifacts", npmDir),
		targz.NewMappedDir("storybook", storybookDir),
		targz.NewMappedDir("plugins-bundled", pluginsDir),
	}

	root := fmt.Sprintf("grafana-%s", version)

	return targz.Build(
		b,
		&targz.Opts{
			Root:        root,
			Files:       files,
			Directories: directories,
		},
	), nil
}

func (t *Tarball) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	panic("not implemented") // TODO: Implement
}

func (t *Tarball) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (t *Tarball) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	return nil
}

func (t *Tarball) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

func (t *Tarball) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Currently verifying riscv64 is unsupported (because alpine and ubuntu don't have riscv64 images yet)
	// windows/darwin verification may never be supported.
	os, arch := backend.OSAndArch(t.Distribution)
	if os != "linux" || arch == "riscv64" {
		return nil
	}

	return verifyTarball(ctx, client, file, t.Grafana, t.YarnCache, t.Distribution, t.Enterprise)
}

func (t *Tarball) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

func (t *Tarball) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		t.Backend,
		t.Frontend,
		t.NPMPackages,
		t.BundledPlugins,
		t.Storybook,
	}, nil
}

func (t *Tarball) Filename(ctx context.Context) (string, error) {
	return packages.FileName(t.Name, t.Version, t.BuildID, t.Distribution, "tar.gz")
}

func verifyTarball(
	ctx context.Context,
	d *dagger.Client,
	pkg *dagger.File,
	src *dagger.Directory,
	yarnCache *dagger.CacheVolume,
	distro backend.Distribution,
	enterprise bool,
) error {
	nodeVersion, err := frontend.NodeVersion(d, src).Stdout(ctx)
	if err != nil {
		return fmt.Errorf("failed to get node version from source code: %w", err)
	}

	var (
		platform = backend.Platform(distro)
		archive  = containers.ExtractedArchive(d, pkg)
	)

	// This grafana service runs in the background for the e2e tests
	service := d.Container(dagger.ContainerOpts{
		Platform: platform,
	}).From("ubuntu:22.04").
		WithExec([]string{"apt-get", "update", "-yq"}).
		WithExec([]string{"apt-get", "install", "-yq", "ca-certificates"}).
		WithDirectory("/src", archive).
		WithMountedTemp("/tmp").
		WithWorkdir("/src")

	if err := e2e.ValidateLicense(ctx, service, "/src/LICENSE", enterprise); err != nil {
		return err
	}

	svc := service.
		WithEnvVariable("GF_PATHS_PLUGINS", "/tmp").
		WithEnvVariable("GF_LOG_LEVEL", "error").
		WithExposedPort(3000).AsService(dagger.ContainerAsServiceOpts{
		Args: []string{"./bin/grafana", "server"},
	})
	result, err := e2e.ValidatePackage(ctx, d, svc, src, yarnCache, nodeVersion)
	if err != nil {
		return err
	}

	if _, err := containers.ExitError(ctx, result); err != nil {
		return err
	}
	return nil
}

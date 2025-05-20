package artifacts

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/docker"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	DockerArguments = arguments.Join(
		TargzArguments,
		[]pipeline.Argument{
			arguments.DockerRegistry,
			arguments.DockerOrg,
			arguments.AlpineImage,
			arguments.UbuntuImage,
			arguments.TagFormat,
			arguments.UbuntuTagFormat,
			arguments.BoringTagFormat,
		},
	)
	DockerFlags = flags.JoinFlags(
		TargzFlags,
		flags.DockerFlags,
	)
)

var DockerInitializer = Initializer{
	InitializerFunc: NewDockerFromString,
	Arguments:       DockerArguments,
}

// PacakgeDocker uses a built tar.gz package to create a docker image from the Dockerfile in the tar.gz
type Docker struct {
	Name       packages.Name
	Version    string
	BuildID    string
	Distro     backend.Distribution
	Enterprise bool

	Ubuntu       bool
	Registry     string
	Repositories []string
	Org          string
	BaseImage    string
	TagFormat    string

	Tarball *pipeline.Artifact

	// Src is the Grafana source code for running e2e tests when validating.
	// The grafana source should not be used for anything else when building a docker image. All files in the Docker image, including the Dockerfile, should be
	// from the tar.gz file.
	Src       *dagger.Directory
	YarnCache *dagger.CacheVolume
}

func (d *Docker) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		d.Tarball,
	}, nil
}

func (d *Docker) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	targz, err := opts.Store.File(ctx, d.Tarball)
	if err != nil {
		return nil, err
	}

	return docker.Builder(opts.Client, opts.Client.Host().UnixSocket("/var/run/docker.sock"), targz), nil
}

func (d *Docker) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	// Unlike most other things we push to, docker image tags do not support all characters.
	// Specifically, the `+` character used in the `buildmetadata` section of semver.
	version := strings.ReplaceAll(d.Version, "+", "-")

	tags, err := docker.Tags(d.Org, d.Registry, d.Repositories, d.TagFormat, packages.NameOpts{
		Name:    d.Name,
		Version: version,
		BuildID: d.BuildID,
		Distro:  d.Distro,
	})
	if err != nil {
		return nil, err
	}
	buildOpts := &docker.BuildOpts{
		// Tags are provided as the '-t' argument, and can include the registry domain as well as the repository.
		// Docker build supports building the same image with multiple tags.
		// You might want to also include a 'latest' version of the tag.
		Tags:     tags,
		Platform: backend.Platform(d.Distro),
		BuildArgs: []string{
			"GRAFANA_TGZ=grafana.tar.gz",
			"GO_SRC=tgz-builder",
			"JS_SRC=tgz-builder",
			fmt.Sprintf("BASE_IMAGE=%s", d.BaseImage),
		},
	}

	b := docker.Build(opts.Client, builder, buildOpts)

	return docker.Save(b, buildOpts), nil
}

func (d *Docker) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	panic("This artifact does not produce directories")
}

func (d *Docker) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	socket := opts.Client.Host().UnixSocket("/var/run/docker.sock")
	return opts.Client.Container().From("docker").WithUnixSocket("/var/run/docker.sock", socket), nil
}

func (d *Docker) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented")
}

func (d *Docker) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("This artifact does not produce directories")
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (d *Docker) Filename(ctx context.Context) (string, error) {
	ext := "docker.tar.gz"
	if d.Ubuntu {
		ext = "ubuntu.docker.tar.gz"
	}

	return packages.FileName(d.Name, d.Version, d.BuildID, d.Distro, ext)
}

func (d *Docker) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	// Currently verifying riscv64 is unsupported (because alpine and ubuntu don't have riscv64 images yet)
	if _, arch := backend.OSAndArch(d.Distro); arch == "riscv64" {
		return nil
	}

	return docker.Verify(ctx, client, file, d.Src, d.YarnCache, d.Distro)
}

func (d *Docker) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

func NewDockerFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	options, err := pipeline.ParseFlags(artifact, DockerFlags)
	if err != nil {
		return nil, err
	}

	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}

	tarball, err := NewTarballFromString(ctx, log, artifact, state)
	if err != nil {
		return nil, err
	}

	ubuntu, err := options.Bool(flags.Ubuntu)
	if err != nil {
		return nil, err
	}

	// Ubuntu Version to use as the base for the Grafana docker image (if this is a ubuntu artifact)
	// This shouldn't fail if it's not set by the user, instead it'll default to 22.04 or something.
	ubuntuImage, err := state.String(ctx, arguments.UbuntuImage)
	if err != nil {
		return nil, err
	}

	// Same for Alpine
	alpineImage, err := state.String(ctx, arguments.AlpineImage)
	if err != nil {
		return nil, err
	}

	registry, err := state.String(ctx, arguments.DockerRegistry)
	if err != nil {
		return nil, err
	}

	org, err := state.String(ctx, arguments.DockerOrg)
	if err != nil {
		return nil, err
	}

	repos, err := options.StringSlice(flags.DockerRepositories)
	if err != nil {
		return nil, err
	}

	format, err := state.String(ctx, arguments.TagFormat)
	if err != nil {
		return nil, err
	}
	ubuntuFormat, err := state.String(ctx, arguments.UbuntuTagFormat)
	if err != nil {
		return nil, err
	}
	boringFormat, err := state.String(ctx, arguments.BoringTagFormat)
	if err != nil {
		return nil, err
	}

	base := alpineImage
	if ubuntu {
		format = ubuntuFormat
		base = ubuntuImage
	}

	if p.Name == packages.PackageEnterpriseBoring {
		format = boringFormat
	}

	src, err := state.Directory(ctx, arguments.GrafanaDirectory)
	if err != nil {
		return nil, err
	}

	yarnCache, err := state.CacheVolume(ctx, arguments.YarnCacheDirectory)
	if err != nil {
		return nil, err
	}

	log.Info("initializing Docker artifact", "Org", org, "registry", registry, "repos", repos, "tag", format)

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler: &Docker{
			Name:       p.Name,
			Version:    p.Version,
			BuildID:    p.BuildID,
			Distro:     p.Distribution,
			Enterprise: p.Enterprise,
			Tarball:    tarball,

			Ubuntu:       ubuntu,
			BaseImage:    base,
			Registry:     registry,
			Org:          org,
			Repositories: repos,
			TagFormat:    format,

			Src:       src,
			YarnCache: yarnCache,
		},
		Type:  pipeline.ArtifactTypeFile,
		Flags: DockerFlags,
	})
}

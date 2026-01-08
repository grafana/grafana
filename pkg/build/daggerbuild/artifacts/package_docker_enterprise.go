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
	EntDockerArguments = arguments.Join(
		DebArguments,
		[]pipeline.Argument{
			arguments.HGDirectory,
			arguments.EntDockerRegistry,
			arguments.EntDockerOrg,
			arguments.EntDockerRepo,
			arguments.HGTagFormat,
		},
	)
	EntDockerFlags = flags.JoinFlags(
		DebFlags,
		flags.DockerFlags,
	)
)

var EntDockerInitializer = Initializer{
	InitializerFunc: NewEntDockerFromString,
	Arguments:       EntDockerArguments,
}

// EntDocker uses a built deb installer to create a docker image
type EntDocker struct {
	Name    packages.Name
	Version string
	BuildID string
	Distro  backend.Distribution
	EntDir  *dagger.Directory

	// EntRegistry is the docker registry when using the `enterprise` name. (e.g. hub.docker.io)
	EntRegistry string
	// EntOrg is the docker org when using the `enterprise` name. (e.g. grafana)
	EntOrg string
	// EntOrg is the docker repo when using the `enterprise` name. (e.g. grafana-enterprise)
	EntRepo string
	// TagFormat is the docker tag format when using the `enterprise` name. (e.g. {{ .version }}-{{ .os }}-{{ .arch }})
	TagFormat string

	Deb *pipeline.Artifact
}

func (d *EntDocker) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		d.Deb,
	}, nil
}

func (d *EntDocker) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	deb, err := opts.Store.File(ctx, d.Deb)
	if err != nil {
		return nil, fmt.Errorf("error getting deb from state: %w", err)
	}

	socket := opts.Client.Host().UnixSocket("/var/run/docker.sock")

	return opts.Client.Container().From("docker").
		WithUnixSocket("/var/run/docker.sock", socket).
		WithMountedDirectory("/src", d.EntDir).
		WithMountedFile("/src/grafana.deb", deb).
		WithWorkdir("/src"), nil
}

func (d *EntDocker) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	tags, err := docker.Tags(d.EntOrg, d.EntRegistry, []string{d.EntRepo}, d.TagFormat, packages.NameOpts{
		Name:    d.Name,
		Version: d.Version,
		BuildID: d.BuildID,
		Distro:  d.Distro,
	})

	if err != nil {
		return nil, err
	}

	builder = docker.Build(opts.Client, builder, &docker.BuildOpts{
		Dockerfile: "./docker/hosted-grafana-all/Dockerfile",
		Tags:       tags,
		Target:     "hosted-grafana-localenterprise",
		Platform:   dagger.Platform("linux/amd64"),
		BuildArgs: []string{
			"RELEASE_TYPE=main",
			// I think because deb files use a ~ as a version delimiter of some kind, so the hg docker image uses that instead of a -
			fmt.Sprintf("GRAFANA_VERSION=%s", strings.Replace(d.Version, "-", "~", 1)),
		},
	})

	// Save the resulting docker image to the local filesystem
	return builder.WithExec([]string{"docker", "save", tags[0], "-o", "enterprise.tar"}).File("enterprise.tar"), nil
}

func (d *EntDocker) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	panic("This artifact does not produce directories")
}

func (d *EntDocker) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented")
}

func (d *EntDocker) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented")
}

func (d *EntDocker) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("This artifact does not produce directories")
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (d *EntDocker) Filename(ctx context.Context) (string, error) {
	ext := "docker-enterprise.tar.gz"

	return packages.FileName(d.Name, d.Version, d.BuildID, d.Distro, ext)
}

func (d *EntDocker) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
}

func (d *EntDocker) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

func NewEntDockerFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	options, err := pipeline.ParseFlags(artifact, DockerFlags)
	if err != nil {
		return nil, err
	}

	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}

	deb, err := NewDebFromString(ctx, log, artifact, state)
	if err != nil {
		return nil, err
	}

	entRegistry, err := state.String(ctx, arguments.EntDockerRegistry)
	if err != nil {
		return nil, err
	}
	entOrg, err := state.String(ctx, arguments.EntDockerOrg)
	if err != nil {
		return nil, err
	}
	entRepo, err := state.String(ctx, arguments.EntDockerRepo)
	if err != nil {
		return nil, err
	}
	tagFormat, err := state.String(ctx, arguments.HGTagFormat)
	if err != nil {
		return nil, err
	}

	dir, err := state.Directory(ctx, arguments.HGDirectory)
	if err != nil {
		return nil, err
	}

	log.Info("initializing Enterprise Docker artifact", "Org", entOrg, "registry", entRegistry, "repo", entRepo, "tag", tagFormat)

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler: &EntDocker{
			Name:    p.Name,
			Version: p.Version,
			BuildID: p.BuildID,
			Distro:  p.Distribution,
			EntDir:  dir,
			Deb:     deb,

			EntRegistry: entRegistry,
			EntOrg:      entOrg,
			EntRepo:     entRepo,
			TagFormat:   tagFormat,
		},
		Type:  pipeline.ArtifactTypeFile,
		Flags: DockerFlags,
	})
}

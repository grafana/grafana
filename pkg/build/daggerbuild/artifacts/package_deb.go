package artifacts

import (
	"context"
	"log/slog"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/fpm"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	DebArguments = TargzArguments
	DebFlags     = flags.JoinFlags(
		TargzFlags,
		[]pipeline.Flag{
			flags.NightlyFlag,
		},
	)
)

var DebInitializer = Initializer{
	InitializerFunc: NewDebFromString,
	Arguments:       TargzArguments,
}

// PacakgeDeb uses a built tar.gz package to create a .deb installer for debian based Linux distributions.
type Deb struct {
	Name         packages.Name
	Version      string
	BuildID      string
	Distribution backend.Distribution
	Enterprise   bool
	NameOverride string

	Tarball *pipeline.Artifact

	// Src is the source tree of Grafana. This should only be used in the verify function.
	Src       *dagger.Directory
	YarnCache *dagger.CacheVolume
}

func (d *Deb) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		d.Tarball,
	}, nil
}

func (d *Deb) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return fpm.Builder(opts.Client), nil
}

func debVersion(version string) string {
	// If there is a `+security-` modifier to the version, simply use `-`
	return strings.ReplaceAll(version, "+security-", "-")
}

func (d *Deb) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	targz, err := opts.Store.File(ctx, d.Tarball)
	if err != nil {
		return nil, err
	}

	return fpm.Build(builder, fpm.BuildOpts{
		Name:         d.Name,
		Enterprise:   d.Enterprise,
		Version:      debVersion(d.Version),
		BuildID:      d.BuildID,
		Distribution: d.Distribution,
		PackageType:  fpm.PackageTypeDeb,
		NameOverride: d.NameOverride,
		ConfigFiles: [][]string{
			{"/src/packaging/deb/default/grafana-server", "/pkg/etc/default/grafana-server"},
			{"/src/packaging/deb/init.d/grafana-server", "/pkg/etc/init.d/grafana-server"},
			{"/src/packaging/deb/systemd/grafana-server.service", "/pkg/usr/lib/systemd/system/grafana-server.service"},
		},
		AfterInstall: "/src/packaging/deb/control/postinst",
		BeforeRemove: "/src/packaging/deb/control/prerm",
		Depends: []string{
			"adduser",
			"musl",
		},
		EnvFolder: "/pkg/etc/default",
		ExtraArgs: []string{
			"--deb-no-default-config-files",
		},
	}, targz), nil
}

func (d *Deb) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	panic("not implemented") // TODO: Implement
}

func (d *Deb) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (d *Deb) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (d *Deb) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (d *Deb) Filename(ctx context.Context) (string, error) {
	name := d.Name
	if d.NameOverride != "" {
		name = packages.Name(d.NameOverride)
	}

	return packages.FileName(name, d.Version, d.BuildID, d.Distribution, "deb")
}

func (d *Deb) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return fpm.VerifyDeb(ctx, client, file, d.Src, d.YarnCache, d.Distribution, d.Enterprise)
}

func (d *Deb) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

func NewDebFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	tarball, err := NewTarballFromString(ctx, log, artifact, state)
	if err != nil {
		return nil, err
	}
	options, err := pipeline.ParseFlags(artifact, DebFlags)
	if err != nil {
		return nil, err
	}
	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}
	src, err := state.Directory(ctx, arguments.GrafanaDirectory)
	if err != nil {
		return nil, err
	}
	yarnCache, err := state.CacheVolume(ctx, arguments.YarnCacheDirectory)
	if err != nil {
		return nil, err
	}

	debname := string(p.Name)
	if nightly, _ := options.Bool(flags.Nightly); nightly {
		debname += "-nightly"
	}
	if rpi, _ := options.Bool(flags.RPI); rpi {
		debname += "-rpi"
	}

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler: &Deb{
			Name:         p.Name,
			Version:      p.Version,
			BuildID:      p.BuildID,
			Distribution: p.Distribution,
			Enterprise:   p.Enterprise,
			Tarball:      tarball,
			Src:          src,
			YarnCache:    yarnCache,
			NameOverride: debname,
		},
		Type:  pipeline.ArtifactTypeFile,
		Flags: TargzFlags,
	})
}

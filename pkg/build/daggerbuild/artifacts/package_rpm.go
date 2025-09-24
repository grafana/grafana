package artifacts

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/flags"
	"github.com/grafana/grafana/pkg/build/daggerbuild/fpm"
	"github.com/grafana/grafana/pkg/build/daggerbuild/gpg"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	RPMArguments = TargzArguments
	RPMFlags     = flags.JoinFlags(
		TargzFlags,
		[]pipeline.Flag{
			flags.SignFlag,
			flags.NightlyFlag,
		},
	)
)

var RPMInitializer = Initializer{
	InitializerFunc: NewRPMFromString,
	Arguments: arguments.Join(
		TargzArguments,
		[]pipeline.Argument{
			arguments.GPGPublicKey,
			arguments.GPGPrivateKey,
			arguments.GPGPassphrase,
		},
	),
}

// PacakgeRPM uses a built tar.gz package to create a .rpm installer for RHEL-ish Linux distributions.
type RPM struct {
	Name         packages.Name
	Version      string
	BuildID      string
	Distribution backend.Distribution
	Enterprise   bool
	Sign         bool
	NameOverride string

	GPGPublicKey  string
	GPGPrivateKey string
	GPGPassphrase string

	Src       *dagger.Directory
	YarnCache *dagger.CacheVolume

	Tarball *pipeline.Artifact
}

func (d *RPM) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		d.Tarball,
	}, nil
}

func (d *RPM) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return fpm.Builder(opts.Client), nil
}

func rpmVersion(version string) string {
	// https://docs.fedoraproject.org/en-US/packaging-guidelines/Versioning/#_snapshots
	// If there's a buildmeta revision, then use that as a snapshot version
	return strings.ReplaceAll(version, "+", "^")
}

func (d *RPM) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	targz, err := opts.Store.File(ctx, d.Tarball)
	if err != nil {
		return nil, err
	}

	rpm := fpm.Build(builder, fpm.BuildOpts{
		Name:         d.Name,
		Enterprise:   d.Enterprise,
		Version:      rpmVersion(d.Version),
		BuildID:      d.BuildID,
		Distribution: d.Distribution,
		PackageType:  fpm.PackageTypeRPM,
		NameOverride: d.NameOverride,
		ConfigFiles: [][]string{
			{"/src/packaging/rpm/sysconfig/grafana-server", "/pkg/etc/sysconfig/grafana-server"},
			{"/src/packaging/rpm/systemd/grafana-server.service", "/pkg/usr/lib/systemd/system/grafana-server.service"},
		},
		AfterInstall: "/src/packaging/rpm/control/postinst",
		Depends: []string{
			"/sbin/service",
		},
		ExtraArgs: []string{
			"--rpm-posttrans=/src/packaging/rpm/control/posttrans",
			"--rpm-digest=sha256",
		},
		EnvFolder: "/pkg/etc/sysconfig",
	}, targz)

	if !d.Sign {
		return rpm, nil
	}
	return gpg.Sign(opts.Client, rpm, gpg.GPGOpts{
		GPGPublicKey:  d.GPGPublicKey,
		GPGPrivateKey: d.GPGPrivateKey,
		GPGPassphrase: d.GPGPassphrase,
	}), nil
}

func (d *RPM) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	panic("not implemented") // TODO: Implement
}

func (d *RPM) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented") // TODO: Implement
}

func (d *RPM) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (d *RPM) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (d *RPM) Filename(ctx context.Context) (string, error) {
	name := d.Name
	if d.NameOverride != "" {
		name = packages.Name(d.NameOverride)
	}

	return packages.FileName(name, d.Version, d.BuildID, d.Distribution, "rpm")
}

func (d *RPM) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
	// return fpm.VerifyRpm(ctx, client, file, d.Src, d.YarnCache, d.Distribution, d.Enterprise, d.Sign, d.GPGPublicKey, d.GPGPrivateKey, d.GPGPassphrase)
}

func (d *RPM) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

func NewRPMFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	tarball, err := NewTarballFromString(ctx, log, artifact, state)
	if err != nil {
		return nil, err
	}
	options, err := pipeline.ParseFlags(artifact, RPMFlags)
	if err != nil {
		return nil, err
	}
	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}
	sign, err := options.Bool(flags.Sign)
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

	var gpgPublicKey, gpgPrivateKey, gpgPassphrase string

	if sign {
		pubb64, err := state.String(ctx, arguments.GPGPublicKey)
		if err != nil {
			return nil, err
		}
		pub, err := base64.StdEncoding.DecodeString(pubb64)
		if err != nil {
			return nil, fmt.Errorf("gpg-private-key-base64 cannot be decoded %w", err)
		}

		privb64, err := state.String(ctx, arguments.GPGPrivateKey)
		if err != nil {
			return nil, err
		}
		priv, err := base64.StdEncoding.DecodeString(privb64)
		if err != nil {
			return nil, fmt.Errorf("gpg-private-key-base64 cannot be decoded %w", err)
		}

		pass, err := state.String(ctx, arguments.GPGPassphrase)
		if err != nil {
			return nil, err
		}

		gpgPublicKey = string(pub)
		gpgPrivateKey = string(priv)
		gpgPassphrase = pass
	}

	rpmname := string(p.Name)
	if nightly, _ := options.Bool(flags.Nightly); nightly {
		rpmname += "-nightly"
	}
	if rpi, _ := options.Bool(flags.RPI); rpi {
		rpmname += "-rpi"
	}

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler: &RPM{
			Name:          p.Name,
			Version:       p.Version,
			BuildID:       p.BuildID,
			Distribution:  p.Distribution,
			Enterprise:    p.Enterprise,
			Tarball:       tarball,
			Sign:          sign,
			Src:           src,
			YarnCache:     yarnCache,
			GPGPublicKey:  gpgPublicKey,
			GPGPrivateKey: gpgPrivateKey,
			GPGPassphrase: gpgPassphrase,
			NameOverride:  rpmname,
		},
		Type:  pipeline.ArtifactTypeFile,
		Flags: TargzFlags,
	})
}

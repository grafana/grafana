package artifacts

import (
	"context"
	"fmt"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/msi"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	MSIArguments = TargzArguments
	MSIFlags     = TargzFlags
)

var MSIInitializer = Initializer{
	InitializerFunc: NewMSIFromString,
	Arguments:       TargzArguments,
}

// PacakgeMSI uses a built tar.gz package to create a .exe installer for exeian based Linux distributions.
type MSI struct {
	Name         packages.Name
	Version      string
	BuildID      string
	Distribution backend.Distribution
	Enterprise   bool
	Grafana      *dagger.Directory

	Tarball *pipeline.Artifact
}

func (d *MSI) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		d.Tarball,
	}, nil
}

func (d *MSI) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return msi.Builder(opts.Client, d.Grafana), nil
}

func (d *MSI) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	targz, err := opts.Store.File(ctx, d.Tarball)
	if err != nil {
		return nil, err
	}

	return msi.Build(opts.Client, builder, targz, d.Version, d.Enterprise)
}

func (d *MSI) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	// Not a directory so this shouldn't be called
	return nil, nil
}

func (d *MSI) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return nil, nil
}

func (d *MSI) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	panic("not implemented") // TODO: Implement
}

func (d *MSI) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	// Not a directory so this shouldn't be called
	return nil
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (d *MSI) Filename(ctx context.Context) (string, error) {
	return packages.FileName(d.Name, d.Version, d.BuildID, d.Distribution, "msi")
}

func (d *MSI) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
}

func (d *MSI) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

func NewMSIFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	targz, err := NewTarballFromString(ctx, log, artifact, state)
	if err != nil {
		return nil, err
	}
	options, err := pipeline.ParseFlags(artifact, MSIFlags)
	if err != nil {
		return nil, err
	}
	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}

	if !backend.IsWindows(p.Distribution) {
		return nil, fmt.Errorf("distribution ('%s') for exe '%s' is not a Windows distribution", string(p.Distribution), artifact)
	}

	src, err := GrafanaDir(ctx, state, p.Enterprise)
	if err != nil {
		return nil, err
	}

	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler: &MSI{
			Name:         p.Name,
			Version:      p.Version,
			BuildID:      p.BuildID,
			Distribution: p.Distribution,
			Enterprise:   p.Enterprise,
			Tarball:      targz,
			Grafana:      src,
		},
		Type:  pipeline.ArtifactTypeFile,
		Flags: ZipFlags,
	})
}

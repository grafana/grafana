package artifacts

import (
	"context"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/grafana/grafana/pkg/build/daggerbuild/zip"
)

var (
	ZipArguments = TargzArguments
	ZipFlags     = TargzFlags
)

var ZipInitializer = Initializer{
	InitializerFunc: NewZipFromString,
	Arguments:       TargzArguments,
}

// PacakgeZip uses a built tar.gz package to create a .zip package for zipian based Linux distributions.
type Zip struct {
	Name         packages.Name
	Version      string
	BuildID      string
	Distribution backend.Distribution
	Enterprise   bool

	Tarball *pipeline.Artifact
}

func (d *Zip) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{
		d.Tarball,
	}, nil
}

func (d *Zip) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return zip.Builder(opts.Client), nil
}

func (d *Zip) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	targz, err := opts.Store.File(ctx, d.Tarball)
	if err != nil {
		return nil, err
	}

	return zip.Build(builder, targz), nil
}

func (d *Zip) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	panic("not implemented") // TODO: Implement
}

func (d *Zip) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return nil, nil
}

func (d *Zip) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	return nil
}

func (d *Zip) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

func (d *Zip) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
}

func (d *Zip) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (d *Zip) Filename(ctx context.Context) (string, error) {
	return packages.FileName(d.Name, d.Version, d.BuildID, d.Distribution, "zip")
}

func NewZipFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	tarball, err := NewTarballFromString(ctx, log, artifact, state)
	if err != nil {
		return nil, err
	}
	options, err := pipeline.ParseFlags(artifact, ZipFlags)
	if err != nil {
		return nil, err
	}
	p, err := GetPackageDetails(ctx, options, state)
	if err != nil {
		return nil, err
	}
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Handler: &Zip{
			Name:         p.Name,
			Version:      p.Version,
			BuildID:      p.BuildID,
			Distribution: p.Distribution,
			Enterprise:   p.Enterprise,
			Tarball:      tarball,
		},
		Type:  pipeline.ArtifactTypeFile,
		Flags: TargzFlags,
	})
}

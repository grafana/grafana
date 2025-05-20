package artifacts

import (
	"context"
	"log/slog"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

var (
	VersionArguments = []pipeline.Argument{
		arguments.GrafanaDirectory,
		arguments.Version,
	}

	VersionFlags = TargzFlags
)

var VersionInitializer = Initializer{
	InitializerFunc: NewVersionFromString,
	Arguments:       VersionArguments,
}

type Version struct {
	// Version is embedded in the binary at build-time
	Version string
}

func (b *Version) Builder(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return opts.Client.Container().WithNewFile("/VERSION", b.Version), nil
}

func (b *Version) Dependencies(ctx context.Context) ([]*pipeline.Artifact, error) {
	return []*pipeline.Artifact{}, nil
}

func (b *Version) BuildFile(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.File, error) {
	return builder.File("/VERSION"), nil
}

func (b *Version) BuildDir(ctx context.Context, builder *dagger.Container, opts *pipeline.ArtifactContainerOpts) (*dagger.Directory, error) {
	return nil, nil
}

func (b *Version) Publisher(ctx context.Context, opts *pipeline.ArtifactContainerOpts) (*dagger.Container, error) {
	return nil, nil
}

func (b *Version) PublishFile(ctx context.Context, opts *pipeline.ArtifactPublishFileOpts) error {
	return nil
}

func (b *Version) PublishDir(ctx context.Context, opts *pipeline.ArtifactPublishDirOpts) error {
	panic("not implemented") // TODO: Implement
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (b *Version) Filename(ctx context.Context) (string, error) {
	return "VERSION", nil
}

func (b *Version) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	return nil
}

func (b *Version) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	return nil
}

func NewVersionFromString(ctx context.Context, log *slog.Logger, artifact string, state pipeline.StateHandler) (*pipeline.Artifact, error) {
	version, err := state.String(ctx, arguments.Version)
	if err != nil {
		return nil, err
	}

	return NewVersion(ctx, log, artifact, version)
}

func NewVersion(ctx context.Context, log *slog.Logger, artifact, version string) (*pipeline.Artifact, error) {
	return pipeline.ArtifactWithLogging(ctx, log, &pipeline.Artifact{
		ArtifactString: artifact,
		Type:           pipeline.ArtifactTypeFile,
		Flags:          VersionFlags,
		Handler: &Version{
			Version: version,
		},
	})
}

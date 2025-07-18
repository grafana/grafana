package pipeline

import (
	"context"
	"log/slog"

	"dagger.io/dagger"
)

type ArtifactHandlerLogger struct {
	Handler ArtifactHandler
	log     *slog.Logger
}

func (a *ArtifactHandlerLogger) Dependencies(ctx context.Context) ([]*Artifact, error) {
	a.log.InfoContext(ctx, "getting dependencies...")
	deps, err := a.Handler.Dependencies(ctx)
	if err != nil {
		a.log.InfoContext(ctx, "error getting dependencies", "error", err)
		return nil, err
	}
	a.log.InfoContext(ctx, "got dependencies", "count", len(deps))

	return deps, nil
}

func (a *ArtifactHandlerLogger) Builder(ctx context.Context, opts *ArtifactContainerOpts) (*dagger.Container, error) {
	a.log.InfoContext(ctx, "getting builder...")
	builder, err := a.Handler.Builder(ctx, opts)
	if err != nil {
		a.log.InfoContext(ctx, "error getting builder", "error", err)
		return nil, err
	}
	a.log.InfoContext(ctx, "got builder")

	return builder, nil
}

func (a *ArtifactHandlerLogger) BuildFile(ctx context.Context, builder *dagger.Container, opts *ArtifactContainerOpts) (*dagger.File, error) {
	a.log.InfoContext(ctx, "building file...")
	file, err := a.Handler.BuildFile(ctx, builder, opts)
	if err != nil {
		a.log.InfoContext(ctx, "error building file", "error", err)
		return nil, err
	}
	a.log.InfoContext(ctx, "done building file")

	return file, nil
}

func (a *ArtifactHandlerLogger) BuildDir(ctx context.Context, builder *dagger.Container, opts *ArtifactContainerOpts) (*dagger.Directory, error) {
	a.log.InfoContext(ctx, "building directory...")
	dir, err := a.Handler.BuildDir(ctx, builder, opts)
	if err != nil {
		a.log.InfoContext(ctx, "error building directory", "error", err)
		return nil, err
	}
	a.log.InfoContext(ctx, "done building directory")

	return dir, nil
}

func (a *ArtifactHandlerLogger) Publisher(ctx context.Context, opts *ArtifactContainerOpts) (*dagger.Container, error) {
	panic("not implemented")
}

func (a *ArtifactHandlerLogger) PublishFile(ctx context.Context, opts *ArtifactPublishFileOpts) error {
	panic("not implemented")
}

func (a *ArtifactHandlerLogger) PublishDir(ctx context.Context, opts *ArtifactPublishDirOpts) error {
	panic("not implemented")
}

// Filename should return a deterministic file or folder name that this build will produce.
// This filename is used as a map key for caching, so implementers need to ensure that arguments or flags that affect the output
// also affect the filename to ensure that there are no collisions.
// For example, the backend for `linux/amd64` and `linux/arm64` should not both produce a `bin` folder, they should produce a
// `bin/linux-amd64` folder and a `bin/linux-arm64` folder. Callers can mount this as `bin` or whatever if they want.
func (a *ArtifactHandlerLogger) Filename(ctx context.Context) (string, error) {
	a.log.DebugContext(ctx, "Getting filename...")
	f, err := a.Handler.Filename(ctx)
	if err != nil {
		a.log.DebugContext(ctx, "error getting filename", "error", err)
		return "", err
	}
	a.log.DebugContext(ctx, "done getting filename")

	return f, nil
}

func (a *ArtifactHandlerLogger) VerifyFile(ctx context.Context, client *dagger.Client, file *dagger.File) error {
	a.log.InfoContext(ctx, "verifying file...")
	if err := a.Handler.VerifyFile(ctx, client, file); err != nil {
		a.log.InfoContext(ctx, "error verifying file", "error", err)
		return err
	}
	a.log.InfoContext(ctx, "done verifying file")

	return nil
}

func (a *ArtifactHandlerLogger) VerifyDirectory(ctx context.Context, client *dagger.Client, dir *dagger.Directory) error {
	a.log.InfoContext(ctx, "verifying directory...")
	if err := a.Handler.VerifyDirectory(ctx, client, dir); err != nil {
		a.log.InfoContext(ctx, "error verifying file", "error", err)
		return err
	}
	a.log.InfoContext(ctx, "done verifying directory")

	return nil
}

func ArtifactWithLogging(ctx context.Context, log *slog.Logger, a *Artifact) (*Artifact, error) {
	h := a.Handler
	f, err := a.Handler.Filename(ctx)
	if err != nil {
		return nil, err
	}

	logger := log.With("artifact", a.ArtifactString, "filename", f, "service", "ArtifactHandler")

	a.Handler = &ArtifactHandlerLogger{
		log:     logger,
		Handler: h,
	}

	return a, nil
}

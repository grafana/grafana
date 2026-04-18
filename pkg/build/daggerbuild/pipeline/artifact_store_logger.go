package pipeline

import (
	"context"
	"log/slog"

	"dagger.io/dagger"
)

type ArtifactStoreLogger struct {
	Store ArtifactStore
	Log   *slog.Logger
}

func (m *ArtifactStoreLogger) StoreFile(ctx context.Context, a *Artifact, file *dagger.File) error {
	fn, err := a.Handler.Filename(ctx)
	if err != nil {
		return err
	}
	log := m.Log.With("artifact", a.ArtifactString, "path", fn)

	log.DebugContext(ctx, "storing artifact file...")
	if err := m.Store.StoreFile(ctx, a, file); err != nil {
		log.DebugContext(ctx, "error storing artifact file", "error", err)
		return err
	}
	log.DebugContext(ctx, "done storing artifact file")
	return nil
}

func (m *ArtifactStoreLogger) File(ctx context.Context, a *Artifact) (*dagger.File, error) {
	fn, err := a.Handler.Filename(ctx)
	if err != nil {
		return nil, err
	}
	log := m.Log.With("artifact", a.ArtifactString, "path", fn)

	log.DebugContext(ctx, "fetching artifact file...")
	file, err := m.Store.File(ctx, a)
	if err != nil {
		log.DebugContext(ctx, "error fetching artifact file", "error", err)
		return nil, err
	}

	log.DebugContext(ctx, "done fetching artifact file")
	return file, nil
}

func (m *ArtifactStoreLogger) StoreDirectory(ctx context.Context, a *Artifact, dir *dagger.Directory) error {
	fn, err := a.Handler.Filename(ctx)
	if err != nil {
		return err
	}
	log := m.Log.With("artifact", a.ArtifactString, "path", fn)

	log.DebugContext(ctx, "storing artifact directory...")
	if err := m.Store.StoreDirectory(ctx, a, dir); err != nil {
		log.DebugContext(ctx, "error storing artifact directory", "error", err)
		return err
	}
	log.DebugContext(ctx, "done storing artifact directory")
	return nil
}

func (m *ArtifactStoreLogger) Directory(ctx context.Context, a *Artifact) (*dagger.Directory, error) {
	fn, err := a.Handler.Filename(ctx)
	if err != nil {
		return nil, err
	}
	log := m.Log.With("artifact", a.ArtifactString, "path", fn)

	log.DebugContext(ctx, "fetching artifact directory...")
	dir, err := m.Store.Directory(ctx, a)
	if err != nil {
		log.DebugContext(ctx, "error fetching artifact directory", "error", err)
		return nil, err
	}

	log.DebugContext(ctx, "done fetching artifact directory")
	return dir, nil
}

func (m *ArtifactStoreLogger) Export(ctx context.Context, d *dagger.Client, a *Artifact, dst string, checksum bool) ([]string, error) {
	fn, err := a.Handler.Filename(ctx)
	if err != nil {
		return nil, err
	}
	log := m.Log.With("artifact", a.ArtifactString, "path", fn, "destination", dst, "checksum", checksum)

	log.DebugContext(ctx, "exporting artifact...")
	path, err := m.Store.Export(ctx, d, a, dst, checksum)
	if err != nil {
		log.DebugContext(ctx, "error exporting artifact", "error", err)
		return nil, err
	}

	log.DebugContext(ctx, "done exporting artifact")
	return path, nil
}

func (m *ArtifactStoreLogger) Exists(ctx context.Context, a *Artifact) (bool, error) {
	fn, err := a.Handler.Filename(ctx)
	if err != nil {
		return false, err
	}
	log := m.Log.With("artifact", a.ArtifactString, "path", fn)

	log.DebugContext(ctx, "checking existence of artifact...")
	v, err := m.Store.Exists(ctx, a)
	if err != nil {
		log.DebugContext(ctx, "error checking existence of artifact", "error", err)
		return false, err
	}

	log.DebugContext(ctx, "done checking existence of artifact")
	return v, nil
}

func StoreWithLogging(s ArtifactStore, log *slog.Logger) *ArtifactStoreLogger {
	return &ArtifactStoreLogger{
		Store: s,
		Log:   log.With("service", "ArtifactStore"),
	}
}

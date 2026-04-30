package search

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/oklog/ulid/v2"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (b *bleveBackend) uploadSnapshot(ctx context.Context, key resource.NamespacedResource, idx *bleveIndex) (retErr error) {
	ctx, span := tracer.Start(ctx, "search.remote_index_snapshot.upload")
	start := time.Now()
	logger := b.log.New("namespace", key.Namespace, "group", key.Group, "resource", key.Resource)
	var rv int64
	var uploadKey ulid.ULID

	defer func() {
		outcome := "success"
		if retErr != nil {
			outcome = "error"
		}
		attrs := []attribute.KeyValue{
			attribute.String("namespace", key.Namespace),
			attribute.String("group", key.Group),
			attribute.String("resource", key.Resource),
			attribute.String("outcome", outcome),
		}
		if rv > 0 {
			attrs = append(attrs, attribute.Int64("snapshot_rv", rv))
		}
		if uploadKey != (ulid.ULID{}) {
			attrs = append(attrs, attribute.String("snapshot_key", uploadKey.String()))
		}
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
			logger.Warn("Remote index snapshot upload failed", "elapsed", time.Since(start), "err", retErr)
		} else {
			logger.Info("Remote index snapshot upload completed", "elapsed", time.Since(start), "snapshot_key", uploadKey.String(), "snapshot_rv", rv)
		}
		span.SetAttributes(attrs...)
		span.End()
	}()

	logger.Info("Remote index snapshot upload started")

	lockAttrs := []attribute.KeyValue{
		attribute.String("lock_scope", "build"),
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
	}
	span.AddEvent("snapshot.lock.acquire.started", oteltrace.WithAttributes(lockAttrs...))
	lock, err := b.opts.Snapshot.Store.LockBuildIndex(ctx, key)
	if err != nil {
		span.AddEvent("snapshot.lock.acquire.failed", oteltrace.WithAttributes(lockAttrs...))
		return fmt.Errorf("acquiring snapshot upload lock: %w", err)
	}
	span.AddEvent("snapshot.lock.acquire.completed", oteltrace.WithAttributes(lockAttrs...))

	defer func() {
		span.AddEvent("snapshot.lock.release.started", oteltrace.WithAttributes(lockAttrs...))
		if releaseErr := lock.Release(); releaseErr != nil {
			span.AddEvent("snapshot.lock.release.failed", oteltrace.WithAttributes(lockAttrs...))
			logger.Warn("releasing snapshot upload lock", "err", releaseErr)
			return
		}
		span.AddEvent("snapshot.lock.release.completed", oteltrace.WithAttributes(lockAttrs...))
	}()

	stagingDir, err := b.newSnapshotStagingDir(key)
	if err != nil {
		return fmt.Errorf("creating snapshot staging dir: %w", err)
	}
	defer func() { _ = os.RemoveAll(stagingDir) }()

	if err := b.snapshotIndex(idx.index, stagingDir); err != nil {
		return err
	}
	// Lock loss is checked only at step boundaries. The main value of the
	// distributed lock is preventing duplicate snapshot/upload work up front, and
	// the upload path is safe to retry because remote snapshots are immutable and
	// keyed by unique ULIDs.
	if err := checkSnapshotLock(lock); err != nil {
		return err
	}

	// Read RV/build info from the staged snapshot instead of the live index so
	// the uploaded metadata matches the copied snapshot contents even if the live
	// index advanced while CopyTo was running.
	snapshotIdx, err := bleve.OpenUsing(stagingDir, map[string]interface{}{"bolt_timeout": boltTimeout})
	if err != nil {
		return fmt.Errorf("opening staged snapshot: %w", err)
	}

	rv, err = getRV(snapshotIdx)
	bi, biErr := getBuildInfo(snapshotIdx)
	if closeErr := snapshotIdx.Close(); closeErr != nil {
		return fmt.Errorf("closing staged snapshot: %w", closeErr)
	}
	if err != nil {
		return fmt.Errorf("reading snapshot rv: %w", err)
	}
	if biErr != nil {
		return fmt.Errorf("reading snapshot build info: %w", biErr)
	}

	uploadKey, err = b.opts.Snapshot.Store.UploadIndex(ctx, key, stagingDir, IndexMeta{
		GrafanaBuildVersion:   bi.BuildVersion,
		LatestResourceVersion: rv,
	})
	if err != nil {
		return fmt.Errorf("uploading snapshot: %w", err)
	}

	return nil
}

func (b *bleveBackend) snapshotIndex(idx bleve.Index, destDir string) error {
	copyable, ok := idx.(bleve.IndexCopyable)
	if !ok {
		return fmt.Errorf("index does not support snapshot copy")
	}
	if err := copyable.CopyTo(bleve.FileSystemDirectory(destDir)); err != nil {
		return fmt.Errorf("copying index snapshot: %w", err)
	}
	return nil
}

func (b *bleveBackend) newSnapshotStagingDir(key resource.NamespacedResource) (string, error) {
	parent := filepath.Join(b.opts.Root, "snapshots", resourceSubPath(key))
	if !isPathWithinRoot(parent, b.opts.Root) {
		return "", fmt.Errorf("invalid path %s", parent)
	}
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return "", err
	}
	return os.MkdirTemp(parent, "upload-*")
}

func checkSnapshotLock(lock IndexStoreLock) error {
	select {
	case <-lock.Lost():
		return fmt.Errorf("snapshot upload lock lost")
	default:
		return nil
	}
}

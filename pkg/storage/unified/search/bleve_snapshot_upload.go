package search

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/util"
	"github.com/oklog/ulid/v2"
	"go.etcd.io/bbolt"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// errSkipRecentRemote is returned by uploadSnapshot when the cross-instance
// upload-time probe finds a same-version remote snapshot uploaded within
// UploadInterval. Callers treat this as a non-error skip.
var errSkipRecentRemote = errors.New("skipping upload: recent remote snapshot exists")

func (b *bleveBackend) uploadSnapshot(ctx context.Context, key resource.NamespacedResource, idx *bleveIndex) (retErr error) {
	ctx, span := tracer.Start(ctx, "search.remote_index_snapshot.upload")
	start := time.Now()
	logger := b.log.New("namespace", key.Namespace, "group", key.Group, "resource", key.Resource)
	commonSpanAttrs := []attribute.KeyValue{
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
	}
	var rv int64
	var uploadKey ulid.ULID

	defer func() {
		skip := errors.Is(retErr, errSkipRecentRemote)
		outcome := "success"
		switch {
		case skip:
			outcome = "skip_recent_remote"
		case retErr != nil:
			outcome = "error"
		}
		attrs := append([]attribute.KeyValue{}, commonSpanAttrs...)
		attrs = append(attrs, attribute.String("outcome", outcome))
		if rv > 0 {
			attrs = append(attrs, attribute.Int64("snapshot_rv", rv))
		}
		if uploadKey != (ulid.ULID{}) {
			attrs = append(attrs, attribute.String("snapshot_key", uploadKey.String()))
		}
		switch {
		case skip:
			logger.Info("Remote index snapshot upload skipped: recent remote snapshot exists", "elapsed", time.Since(start))
		case retErr != nil:
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
			logger.Warn("Remote index snapshot upload failed", "elapsed", time.Since(start), "err", retErr)
		default:
			logger.Info("Remote index snapshot upload completed", "elapsed", time.Since(start), "snapshot_key", uploadKey.String(), "snapshot_rv", rv)
		}
		span.SetAttributes(attrs...)
		span.End()
	}()

	logger.Info("Remote index snapshot upload started")

	// Cross-instance dedup: if another replica recently uploaded a same-version
	// snapshot for this resource, skip without doing any local work. Probe
	// failures fall through to today's upload path — the probe is an
	// optimisation, not a correctness check.
	if interval := b.opts.Snapshot.UploadInterval; interval > 0 {
		notOlderThan := time.Now().Add(-interval)
		k, _, err := findFreshSnapshotByUploadTime(ctx, b.opts.Snapshot.Store, key, notOlderThan, b.opts.BuildVersion, b.maxSupportedIndexFormat, logger)
		if err != nil {
			logger.Warn("Snapshot upload-time probe failed; proceeding with upload", "err", err)
		} else if k != (ulid.ULID{}) {
			span.SetAttributes(attribute.String("skip_remote_snapshot_key", k.String()))
			return errSkipRecentRemote
		}
	}

	lockAttrs := append([]attribute.KeyValue{attribute.String("lock_scope", "build")}, commonSpanAttrs...)
	span.AddEvent("snapshot.lock.acquire.started", oteltrace.WithAttributes(lockAttrs...))
	lock, err := b.opts.Snapshot.Store.LockBuildIndex(ctx, key, b.opts.BuildVersion)
	if err != nil {
		span.AddEvent("snapshot.lock.acquire.failed", oteltrace.WithAttributes(lockAttrs...))
		return fmt.Errorf("acquiring snapshot upload lock: %w", err)
	}
	span.AddEvent("snapshot.lock.acquire.completed", oteltrace.WithAttributes(lockAttrs...))

	defer func() {
		span.AddEvent("snapshot.lock.release.started", oteltrace.WithAttributes(lockAttrs...))
		if releaseErr := lock.Release(); releaseErr != nil {
			span.AddEvent("snapshot.lock.release.failed", oteltrace.WithAttributes(lockAttrs...))
			// A release failure after UploadIndexSnapshot succeeds does not make the uploaded snapshot invalid.
			logger.Warn("releasing index snapshot upload lock", "err", releaseErr)
			return
		}
		span.AddEvent("snapshot.lock.release.completed", oteltrace.WithAttributes(lockAttrs...))
	}()

	uploadKey, rv, err = b.snapshotCopyAndUpload(ctx, key, idx, lock)
	return err
}

// snapshotCopyAndUpload copies idx to a staging dir, reads its metadata,
// and uploads it to the remote index store. The caller acquires and
// releases the build lock; this helper only re-checks it between steps.
// Returns the uploaded snapshot key and the RV read from the staged copy.
func (b *bleveBackend) snapshotCopyAndUpload(ctx context.Context, key resource.NamespacedResource, idx *bleveIndex, lock IndexStoreLock) (ulid.ULID, int64, error) {
	stagingDir, err := b.newSnapshotStagingDir(key)
	if err != nil {
		return ulid.ULID{}, 0, fmt.Errorf("creating snapshot staging dir: %w", err)
	}
	defer func() { _ = os.RemoveAll(stagingDir) }()

	if err := b.snapshotIndex(idx.index, stagingDir); err != nil {
		return ulid.ULID{}, 0, err
	}
	// Lock loss is checked only at step boundaries. The main value of the
	// distributed lock is preventing duplicate snapshot/upload work up front, and
	// the upload path is safe to retry because remote snapshots are immutable and
	// keyed by unique ULIDs.
	if err := checkSnapshotLock(lock); err != nil {
		return ulid.ULID{}, 0, err
	}

	indexFormat, err := readSnapshotIndexFormat(stagingDir)
	if err != nil {
		return ulid.ULID{}, 0, fmt.Errorf("reading snapshot index format: %w", err)
	}

	// Read RV/build info from the staged snapshot instead of the live index so
	// the uploaded metadata matches the copied snapshot contents even if the live
	// index advanced while CopyTo was running.
	snapshotIdx, err := bleve.OpenUsing(stagingDir, map[string]interface{}{"bolt_timeout": boltTimeout})
	if err != nil {
		return ulid.ULID{}, 0, fmt.Errorf("opening staged snapshot: %w", err)
	}

	rv, err := getRV(snapshotIdx)
	bi, biErr := getBuildInfo(snapshotIdx)
	if closeErr := snapshotIdx.Close(); closeErr != nil {
		return ulid.ULID{}, 0, fmt.Errorf("closing staged snapshot: %w", closeErr)
	}
	if err != nil {
		return ulid.ULID{}, 0, fmt.Errorf("reading snapshot rv: %w", err)
	}
	if biErr != nil {
		return ulid.ULID{}, 0, fmt.Errorf("reading snapshot build info: %w", biErr)
	}

	meta := IndexMeta{
		BuildVersion:          bi.BuildVersion,
		IndexFormat:           indexFormat,
		LatestResourceVersion: rv,
	}
	// bi.BuildTime is the original index creation time; it survives reopens and
	// downloads, so periodic re-uploads keep the original build-start time.
	// Guard zero so legacy indexes without BuildTime stay zero in the manifest.
	if bi.BuildTime > 0 {
		meta.BuildTime = time.Unix(bi.BuildTime, 0).UTC()
	}

	uploadKey, err := UploadIndexSnapshot(ctx, b.opts.Snapshot.Store, key, stagingDir, meta, b.log)
	if err != nil {
		return ulid.ULID{}, 0, fmt.Errorf("uploading snapshot: %w", err)
	}

	return uploadKey, rv, nil
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

// readSnapshotIndexFormat reads the segment format Bleve persisted for this
// snapshot. Bleve uses this metadata internally when opening scorch snapshots,
// but does not expose it through the public Index API.
func readSnapshotIndexFormat(indexDir string) (string, error) {
	db, err := bbolt.Open(filepath.Join(indexDir, "store", "root.bolt"), 0, &bbolt.Options{ReadOnly: true, Timeout: time.Second})
	if err != nil {
		return "", err
	}
	defer func() { _ = db.Close() }()

	var format string
	if err := db.View(func(tx *bbolt.Tx) error {
		snapshots := tx.Bucket(util.BoltSnapshotsBucket)
		if snapshots == nil {
			return fmt.Errorf("snapshots bucket missing")
		}
		k, _ := snapshots.Cursor().Last()
		if k == nil {
			return fmt.Errorf("snapshot metadata missing")
		}
		snapshot := snapshots.Bucket(k)
		if snapshot == nil {
			return fmt.Errorf("snapshot bucket missing")
		}
		meta := snapshot.Bucket(util.BoltMetaDataKey)
		if meta == nil {
			return fmt.Errorf("metadata bucket missing")
		}
		formatType := string(meta.Get(util.BoltMetaDataSegmentTypeKey))
		versionBytes := meta.Get(util.BoltMetaDataSegmentVersionKey)
		if len(versionBytes) < 4 {
			return fmt.Errorf("segment version missing")
		}
		format = indexFormat(formatType, binary.BigEndian.Uint32(versionBytes))
		if format == "" {
			return fmt.Errorf("segment format missing")
		}
		return nil
	}); err != nil {
		return "", err
	}
	return format, nil
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

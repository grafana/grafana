package search

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/blevesearch/bleve/v2"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (b *bleveBackend) uploadSnapshot(ctx context.Context, key resource.NamespacedResource, idx *bleveIndex) (retErr error) {
	lock, err := b.opts.Snapshot.Store.LockBuildIndex(ctx, key)
	if err != nil {
		return fmt.Errorf("acquiring snapshot upload lock: %w", err)
	}
	defer func() {
		releaseErr := lock.Release()
		if releaseErr == nil {
			return
		}
		if retErr == nil {
			retErr = fmt.Errorf("releasing snapshot upload lock: %w", releaseErr)
			return
		}
		retErr = errors.Join(retErr, fmt.Errorf("releasing snapshot upload lock: %w", releaseErr))
	}()

	stagingDir, err := b.newSnapshotStagingDir(key)
	if err != nil {
		return fmt.Errorf("creating snapshot staging dir: %w", err)
	}
	defer func() { _ = os.RemoveAll(stagingDir) }()

	start := time.Now()
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

	rv, rvErr := getRV(snapshotIdx)
	bi, biErr := getBuildInfo(snapshotIdx)
	if closeErr := snapshotIdx.Close(); closeErr != nil {
		return fmt.Errorf("closing staged snapshot: %w", closeErr)
	}
	if rvErr != nil {
		return fmt.Errorf("reading snapshot rv: %w", rvErr)
	}
	if biErr != nil {
		return fmt.Errorf("reading snapshot build info: %w", biErr)
	}

	_, err = b.opts.Snapshot.Store.UploadIndex(ctx, key, stagingDir, IndexMeta{
		GrafanaBuildVersion:   bi.BuildVersion,
		LatestResourceVersion: rv,
	})
	if err != nil {
		return fmt.Errorf("uploading snapshot: %w", err)
	}
	if err := checkSnapshotLock(lock); err != nil {
		return err
	}

	elapsed := time.Since(start)
	b.log.Info("Uploaded remote index snapshot", "key", key, "elapsed", elapsed, "rv", rv)
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

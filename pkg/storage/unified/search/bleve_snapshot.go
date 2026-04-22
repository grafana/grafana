package search

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/Masterminds/semver"
	"github.com/blevesearch/bleve/v2"
	"github.com/oklog/ulid/v2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// snapshotDownloadStatus labels for the index_server_snapshot_downloads_total counter.
const (
	snapshotStatusSuccess       = "success"
	snapshotStatusEmpty         = "empty"
	snapshotStatusDownloadError = "download_error"
	snapshotStatusValidateError = "validate_error"
)

// snapshotCandidate is a remote snapshot that passed hard filters, annotated
// with the preference tier used to pick one.
type snapshotCandidate struct {
	key     ulid.ULID
	meta    *IndexMeta
	version *semver.Version // always non-nil; unparseable entries are dropped earlier
	tier    int             // 0 = best, 2 = last resort
}

// tryDownloadRemoteSnapshot lists remote snapshots for the given resource,
// picks the best candidate using the tiered preference described in the design
// doc, downloads and opens it locally, and returns the resulting bleve index.
//
// Return contract:
//   - On success: (idx, dirName, rv, nil) — caller must take ownership of idx.
//   - No candidate available: (nil, "", 0, nil) — caller should build from scratch.
//   - Error (list/download/open/validate): (nil, "", 0, err) — destDir (if created) is cleaned up.
//
// Metric recording happens here so callers only need to handle the returned values.
func (b *bleveBackend) tryDownloadRemoteSnapshot(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	logger log.Logger,
) (bleve.Index, string, int64, error) {
	store := b.opts.Snapshot.Store
	if store == nil {
		return nil, "", 0, nil
	}

	all, err := store.ListIndexes(ctx, key)
	if err != nil {
		b.recordSnapshotDownloadStatus(snapshotStatusDownloadError)
		return nil, "", 0, fmt.Errorf("listing remote snapshots: %w", err)
	}

	candidate, ok := b.pickBestSnapshot(all, time.Now())
	if !ok {
		b.recordSnapshotDownloadStatus(snapshotStatusEmpty)
		return nil, "", 0, nil
	}

	logger = logger.New(
		"snapshot_key", candidate.key.String(),
		"snapshot_version", candidate.version.String(),
		"snapshot_rv", candidate.meta.LatestResourceVersion,
		"snapshot_uploaded", candidate.meta.UploadTimestamp,
		"snapshot_tier", candidate.tier,
	)

	// Pick a fresh destination directory name. DownloadIndex refuses to overwrite
	// an existing destDir; the bump-on-exists loop mirrors what BuildIndex does
	// when creating new file-based indexes.
	destDir, name, err := b.reserveSnapshotDir(resourceDir)
	if err != nil {
		b.recordSnapshotDownloadStatus(snapshotStatusDownloadError)
		return nil, "", 0, fmt.Errorf("reserving local snapshot dir: %w", err)
	}

	start := time.Now()
	if _, err := store.DownloadIndex(ctx, key, candidate.key, destDir); err != nil {
		_ = os.RemoveAll(destDir)
		b.recordSnapshotDownloadStatus(snapshotStatusDownloadError)
		return nil, "", 0, fmt.Errorf("downloading snapshot: %w", err)
	}

	idx, err := bleve.OpenUsing(destDir, map[string]interface{}{"bolt_timeout": boltTimeout})
	if err != nil {
		_ = os.RemoveAll(destDir)
		b.recordSnapshotDownloadStatus(snapshotStatusValidateError)
		return nil, "", 0, fmt.Errorf("opening downloaded snapshot: %w", err)
	}

	rv, err := b.validateDownloadedIndex(idx)
	if err != nil {
		_ = idx.Close()
		_ = os.RemoveAll(destDir)
		b.recordSnapshotDownloadStatus(snapshotStatusValidateError)
		return nil, "", 0, fmt.Errorf("validating downloaded snapshot: %w", err)
	}

	elapsed := time.Since(start)
	b.recordSnapshotDownloadStatus(snapshotStatusSuccess)
	if b.indexMetrics != nil {
		b.indexMetrics.IndexSnapshotDownloadDuration.Observe(elapsed.Seconds())
	}

	logger.Info("Downloaded remote index snapshot", "elapsed", elapsed, "rv", rv, "directory", destDir)
	return idx, name, rv, nil
}

// pickBestSnapshot applies hard filters (age, unparseable version) and the
// three-tier preference to pick the best snapshot, if any.
//
// Tier 0 (ideal): MinBuildVersion <= v <= runningVersion
// Tier 1 (older, acceptable): v < MinBuildVersion
// Tier 2 (newer, last resort): v > runningVersion
//
// Within each tier, sort by version desc -> RV desc -> upload time desc.
func (b *bleveBackend) pickBestSnapshot(all map[ulid.ULID]*IndexMeta, now time.Time) (snapshotCandidate, bool) {
	maxAge := b.opts.Snapshot.MaxIndexAge
	minVersion := b.opts.Snapshot.MinBuildVersion
	running := b.runningBuildVersion

	candidates := make([]snapshotCandidate, 0, len(all))
	for k, m := range all {
		if m == nil {
			continue
		}
		// Hard filter: age.
		if maxAge > 0 && now.Sub(m.UploadTimestamp) > maxAge {
			continue
		}
		// Hard filter: unparseable version (we can't tier it).
		v, err := semver.NewVersion(m.GrafanaBuildVersion)
		if err != nil {
			continue
		}
		candidates = append(candidates, snapshotCandidate{
			key:     k,
			meta:    m,
			version: v,
			tier:    snapshotTier(v, minVersion, running),
		})
	}

	if len(candidates) == 0 {
		return snapshotCandidate{}, false
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].tier != candidates[j].tier {
			return candidates[i].tier < candidates[j].tier
		}
		if c := candidates[i].version.Compare(candidates[j].version); c != 0 {
			return c > 0
		}
		if candidates[i].meta.LatestResourceVersion != candidates[j].meta.LatestResourceVersion {
			return candidates[i].meta.LatestResourceVersion > candidates[j].meta.LatestResourceVersion
		}
		return candidates[i].meta.UploadTimestamp.After(candidates[j].meta.UploadTimestamp)
	})

	return candidates[0], true
}

// snapshotTier returns the preference tier of v relative to the configured
// lower bound (minVersion) and the running Grafana version. Lower = better.
func snapshotTier(v, minVersion, running *semver.Version) int {
	if running != nil && v.Compare(running) > 0 {
		return 2 // newer than running Grafana: last resort
	}
	if minVersion != nil && v.Compare(minVersion) < 0 {
		return 1 // below preferred floor
	}
	return 0
}

// reserveSnapshotDir returns an absolute path (and its base name) inside
// resourceDir that does not exist yet. It bumps the timestamp if a collision
// happens, mirroring the fresh-build naming in BuildIndex.
func (b *bleveBackend) reserveSnapshotDir(resourceDir string) (string, string, error) {
	if err := os.MkdirAll(resourceDir, 0o750); err != nil {
		return "", "", err
	}

	t := time.Now()
	for {
		name := formatIndexName(t)
		dir := filepath.Join(resourceDir, name)
		if !isPathWithinRoot(dir, b.opts.Root) {
			return "", "", fmt.Errorf("invalid path %s", dir)
		}
		if _, err := os.Stat(dir); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return dir, name, nil
			}
			return "", "", err
		}
		t = t.Add(time.Second)
	}
}

// validateDownloadedIndex reads the internal RV + buildInfo from the opened
// index to confirm the snapshot is well-formed. Returns the RV on success.
func (b *bleveBackend) validateDownloadedIndex(idx bleve.Index) (int64, error) {
	rv, err := getRV(idx)
	if err != nil {
		return 0, fmt.Errorf("reading rv: %w", err)
	}
	if rv <= 0 {
		return 0, fmt.Errorf("snapshot has non-positive rv: %d", rv)
	}
	if _, err := getBuildInfo(idx); err != nil {
		return 0, fmt.Errorf("reading build info: %w", err)
	}
	return rv, nil
}

func (b *bleveBackend) recordSnapshotDownloadStatus(status string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotDownloads.WithLabelValues(status).Inc()
}

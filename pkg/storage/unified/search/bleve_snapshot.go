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
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Labels for the index_server_snapshot_downloads_total counter.
const (
	// snapshotPolicyTiered selects via pickBestSnapshot (initial startup;
	// any version >= MinBuildVersion accepted, with tiered preference).
	snapshotPolicyTiered = "tiered"
	// snapshotPolicySameVersion selects via findFreshSnapshotByBuildStart
	// (rebuild; strict same-version freshness).
	snapshotPolicySameVersion = "same_version"
	// snapshotPolicyColdStart labels downloads taken during cold-start
	// coordination. Strict same-version, freshness against
	// Snapshot.MaxIndexAge.
	snapshotPolicyColdStart = "cold_start"

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
	version *semver.Version // always non-nil; pickBestSnapshot drops unparseable entries
	tier    int             // 0 = best, 2 = last resort
}

// snapshotSelectFn picks a snapshot under a given policy.
//
// Returns:
//   - (key, meta, nil):                a snapshot was chosen.
//   - (zero ULID, nil, nil):           no candidate; caller proceeds to its fallback.
//   - (zero ULID, nil, err):           selection failed; caller treats as a download error.
type snapshotSelectFn func(context.Context) (ulid.ULID, *IndexMeta, error)

// tryDownloadRemoteSnapshot lists remote snapshots for the given resource,
// picks the best candidate (see pickBestSnapshot), downloads and opens it
// locally, and returns the resulting bleve index.
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
	logger.Info("Remote index snapshot download started", "policy", snapshotPolicyTiered)
	return b.downloadSelectedSnapshot(ctx, key, resourceDir,
		snapshotPolicyTiered, "search.remote_index_snapshot.download", logger,
		func(ctx context.Context) (ulid.ULID, *IndexMeta, error) {
			all, err := b.opts.Snapshot.Store.ListIndexes(ctx, key)
			if err != nil {
				return ulid.ULID{}, nil, fmt.Errorf("listing remote snapshots: %w", err)
			}
			notOlderThan := time.Time{}
			if maxAge := b.opts.Snapshot.MaxIndexAge; maxAge > 0 {
				notOlderThan = time.Now().Add(-maxAge)
			}
			c, ok := b.pickBestSnapshot(all, notOlderThan, logger)
			if !ok {
				return ulid.ULID{}, nil, nil
			}
			return c.key, c.meta, nil
		},
	)
}

// tryDownloadFreshSameVersionSnapshot looks for a same-version snapshot
// in the remote index store with BuildTime newer than max(now-maxAge,
// lastImportTime), and downloads it. Shared between the rebuild path and
// cold-start coordination; callers pass their own maxAge and policy /
// span labels. Returns (nil, "", 0, nil) when no candidate matches.
//
// maxAge <= 0 means "no age limit": the only freshness floor is
// lastImportTime (which itself may be zero, meaning no floor at all).
func (b *bleveBackend) tryDownloadFreshSameVersionSnapshot(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	lastImportTime time.Time,
	maxAge time.Duration,
	policy, spanName string,
	logger log.Logger,
) (bleve.Index, string, int64, error) {
	logger.Info("Fresh same-version index snapshot download started", "policy", policy, "max_age", maxAge, "last_import_time", lastImportTime)

	var notOlderThan time.Time
	if maxAge > 0 {
		notOlderThan = time.Now().Add(-maxAge)
	}
	if lastImportTime.After(notOlderThan) {
		notOlderThan = lastImportTime
	}

	return b.downloadSelectedSnapshot(ctx, key, resourceDir, policy, spanName, logger,
		func(ctx context.Context) (ulid.ULID, *IndexMeta, error) {
			k, m, err := findFreshSnapshotByBuildStart(ctx, b.opts.Snapshot.Store, key, notOlderThan, b.opts.BuildVersion)
			if err != nil {
				return ulid.ULID{}, nil, fmt.Errorf("probing for fresh snapshot: %w", err)
			}
			return k, m, nil
		},
	)
}

// downloadSelectedSnapshot is the shared scaffolding for tryDownload*
// helpers: trace span, completion / failure log, outcome metric, and the
// reserve-download-open-validate flow. Each policy provides its
// selection logic via selectFn; the template handles everything else.
func (b *bleveBackend) downloadSelectedSnapshot(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	policy string,
	spanName string,
	logger log.Logger,
	selectFn snapshotSelectFn,
) (_ bleve.Index, _ string, _ int64, retErr error) {
	ctx, span := tracer.Start(ctx, spanName)
	start := time.Now()
	outcome := snapshotStatusSuccess
	var snapKey ulid.ULID
	var meta *IndexMeta

	defer func() {
		attrs := []attribute.KeyValue{
			attribute.String("namespace", key.Namespace),
			attribute.String("group", key.Group),
			attribute.String("resource", key.Resource),
			attribute.String("policy", policy),
			attribute.String("outcome", outcome),
		}
		if meta != nil {
			attrs = append(attrs,
				attribute.String("snapshot_key", snapKey.String()),
				attribute.String("snapshot_version", meta.BuildVersion),
				attribute.Int64("snapshot_rv", meta.LatestResourceVersion),
			)
			// Zero-value BuildTime means the snapshot was uploaded before that
			// field was added to IndexMeta; logging "0001-01-01" would be
			// misleading.
			if !meta.BuildTime.IsZero() {
				attrs = append(attrs, attribute.String("snapshot_build_time", meta.BuildTime.UTC().Format(time.RFC3339)))
			}
		}
		span.SetAttributes(attrs...)
		elapsed := time.Since(start)
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
			logger.Warn("Remote index snapshot download failed", "elapsed", elapsed, "policy", policy, "outcome", outcome, "err", retErr)
		} else {
			logger.Info("Remote index snapshot download completed", "elapsed", elapsed, "policy", policy, "outcome", outcome)
		}
		b.recordSnapshotDownloadOutcome(policy, outcome)
		span.End()
	}()

	var err error
	snapKey, meta, err = selectFn(ctx)
	if err != nil {
		outcome = snapshotStatusDownloadError
		return nil, "", 0, err
	}
	if meta == nil {
		outcome = snapshotStatusEmpty
		return nil, "", 0, nil
	}

	logFields := []any{
		"snapshot_key", snapKey.String(),
		"snapshot_version", meta.BuildVersion,
		"snapshot_rv", meta.LatestResourceVersion,
		"snapshot_uploaded", meta.UploadTimestamp,
	}
	if !meta.BuildTime.IsZero() {
		logFields = append(logFields, "snapshot_build_time", meta.BuildTime)
	}
	logger = logger.New(logFields...)

	// Pick a fresh destination directory name. DownloadIndex refuses to
	// overwrite an existing destDir; the bump-on-exists loop mirrors what
	// BuildIndex does when creating new file-based indexes.
	destDir, name, err := b.reserveSnapshotDir(resourceDir)
	if err != nil {
		outcome = snapshotStatusDownloadError
		return nil, "", 0, fmt.Errorf("reserving local snapshot dir: %w", err)
	}

	// Protect destDir from cleanOldIndexes for the duration of the download
	// and validation. On success, ownership of the registration transfers to
	// the caller (BuildIndex unregisters via its own defer); on any failure
	// path below, this defer releases it.
	b.registerInFlightBuildDir(destDir)
	defer func() {
		if retErr != nil {
			b.unregisterInFlightBuildDir(destDir)
		}
	}()

	// TODO: retry DownloadIndex on transient errors before falling through to
	// a from-scratch KV rebuild. The object store is its own fault domain;
	// a single failed download shouldn't force a full rebuild for large
	// indexes (e.g. a 1M-doc dashboard index would re-pay every read).
	downloadStart := time.Now()
	downloadedMeta, err := b.opts.Snapshot.Store.DownloadIndex(ctx, key, snapKey, destDir)
	if err != nil {
		_ = os.RemoveAll(destDir)
		outcome = snapshotStatusDownloadError
		return nil, "", 0, fmt.Errorf("downloading snapshot: %w", err)
	}

	idx, err := bleve.OpenUsing(destDir, map[string]interface{}{"bolt_timeout": boltTimeout})
	if err != nil {
		_ = os.RemoveAll(destDir)
		outcome = snapshotStatusValidateError
		return nil, "", 0, fmt.Errorf("opening downloaded snapshot: %w", err)
	}

	rv, err := b.validateDownloadedIndex(idx)
	if err != nil {
		_ = idx.Close()
		_ = os.RemoveAll(destDir)
		outcome = snapshotStatusValidateError
		return nil, "", 0, fmt.Errorf("validating downloaded snapshot: %w", err)
	}

	if b.indexMetrics != nil {
		b.indexMetrics.IndexSnapshotDownloadDuration.Observe(time.Since(downloadStart).Seconds())
	}

	uploadedAt := meta.UploadTimestamp
	if downloadedMeta != nil && !downloadedMeta.UploadTimestamp.IsZero() {
		uploadedAt = downloadedMeta.UploadTimestamp
	}
	// A downloaded snapshot becomes the new upload baseline for this index.
	if err := writeSnapshotMutationCount(idx, 0); err != nil {
		_ = idx.Close()
		_ = os.RemoveAll(destDir)
		outcome = snapshotStatusValidateError
		return nil, "", 0, fmt.Errorf("resetting snapshot mutation count: %w", err)
	}
	b.setUploadTracking(key, uploadedAt)

	return idx, name, rv, nil
}

// pickBestSnapshot applies hard filters (upload time, unparseable version)
// and the three-tier preference to pick the best snapshot, if any.
//
// Tier 0 (ideal): MinBuildVersion <= v <= runningVersion
// Tier 1 (older, acceptable): v < MinBuildVersion
// Tier 2 (newer, last resort): v > runningVersion
//
// Within each tier, sort by version desc -> RV desc -> upload time desc.
func (b *bleveBackend) pickBestSnapshot(all map[ulid.ULID]*IndexMeta, notOlderThan time.Time, logger log.Logger) (snapshotCandidate, bool) {
	minVersion := b.opts.Snapshot.MinBuildVersion
	running := b.runningBuildVersion

	var droppedAge, droppedUnparseable int
	candidates := make([]snapshotCandidate, 0, len(all))
	for k, m := range all {
		// Hard filter: age.
		if !notOlderThan.IsZero() && m.UploadTimestamp.Before(notOlderThan) {
			droppedAge++
			continue
		}
		// Hard filter: unparseable version (we can't tier it). Metadata validation
		// lives here rather than in the store so we don't have to duplicate it
		// across store implementations.
		v, err := semver.NewVersion(m.BuildVersion)
		if err != nil {
			droppedUnparseable++
			continue
		}
		c := snapshotCandidate{
			key:     k,
			meta:    m,
			version: v,
			tier:    snapshotTier(v, minVersion, running),
		}
		candidates = append(candidates, c)
		logger.Debug("index snapshot candidate",
			"key", c.key.String(),
			"tier", c.tier,
			"version", c.version.String(),
			"rv", c.meta.LatestResourceVersion,
			"uploaded", c.meta.UploadTimestamp,
		)
	}

	if len(candidates) == 0 {
		logger.Debug("no index snapshot candidates", "total", len(all), "dropped_age", droppedAge, "dropped_unparseable", droppedUnparseable)
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

	logger.Debug("selected index snapshot",
		"key", candidates[0].key.String(),
		"tier", candidates[0].tier,
		"candidates", len(candidates),
		"dropped_age", droppedAge,
		"dropped_unparseable", droppedUnparseable,
	)
	return candidates[0], true
}

// snapshotTier returns the preference tier of v relative to the configured
// lower bound (minVersion) and the running Grafana version. Lower = better.
// running must be non-nil; the caller (NewBleveBackend) enforces this when the
// snapshot feature is enabled.
func snapshotTier(v, minVersion, running *semver.Version) int {
	if v.Compare(running) > 0 {
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

func (b *bleveBackend) recordSnapshotDownloadOutcome(policy, status string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotDownloads.WithLabelValues(policy, status).Inc()
}

// findFreshSnapshotByUploadTime walks namespace snapshots newest-first and
// returns the first one whose BuildVersion matches runningVersion and
// whose ULID time is after notOlderThan. Returns a zero key and nil meta when
// no such snapshot exists.
//
// Walking (rather than checking only the newest) is necessary in mixed-version
// clusters — either transiently during rolling upgrades, or as a deliberate
// steady-state configuration. V1 and V2 replicas may interleave uploads, so
// the newest snapshot can be the wrong version while a same-version match
// lives a few keys back. In homogeneous clusters the walk degenerates to one
// GET.
//
// ErrSnapshotNotFound / ErrInvalidManifest on individual keys is tolerated
// (skip and continue) — these are races with cleanup or concurrently-written
// manifests and shouldn't fail the probe. Other errors are surfaced.
func findFreshSnapshotByUploadTime(
	ctx context.Context,
	store RemoteIndexStore,
	ns resource.NamespacedResource,
	notOlderThan time.Time,
	runningVersion string,
) (ulid.ULID, *IndexMeta, error) {
	return findFreshSnapshot(ctx, store, ns, notOlderThan, runningVersion, func(*IndexMeta) bool {
		return true
	})
}

// findFreshSnapshotByBuildStart is the build-start-time variant of
// findFreshSnapshotByUploadTime: it returns the first same-version
// snapshot whose BuildTime (not upload time) is after notOlderThan.
//
// Use this for data-freshness questions, e.g. "is the remote snapshot
// fresh enough to skip a rebuild?". Periodic re-uploads preserve the
// original BuildTime and are correctly rejected once the
// underlying data ages out, even when their ULID is recent.
//
// Manifests with a zero-value BuildTime are skipped (no freshness
// signal). The stopping rule is unchanged: BuildTime <= ULID time, so a
// ULID below notOlderThan cannot yield a fresh build-start time.
func findFreshSnapshotByBuildStart(
	ctx context.Context,
	store RemoteIndexStore,
	ns resource.NamespacedResource,
	notOlderThan time.Time,
	runningVersion string,
) (ulid.ULID, *IndexMeta, error) {
	return findFreshSnapshot(ctx, store, ns, notOlderThan, runningVersion, func(meta *IndexMeta) bool {
		return !meta.BuildTime.IsZero() && meta.BuildTime.After(notOlderThan)
	})
}

func findFreshSnapshot(
	ctx context.Context,
	store RemoteIndexStore,
	ns resource.NamespacedResource,
	notOlderThan time.Time,
	runningVersion string,
	isFresh func(*IndexMeta) bool,
) (ulid.ULID, *IndexMeta, error) {
	keys, err := store.ListIndexKeys(ctx, ns)
	if err != nil {
		return ulid.ULID{}, nil, fmt.Errorf("listing index keys: %w", err)
	}

	// Sort newest-first by ULID time. ULID time equals upload time, and upload
	// time is an upper bound for build-start time, so once we cross notOlderThan
	// no remaining candidate can satisfy either freshness check.
	sort.Slice(keys, func(i, j int) bool {
		return keys[i].Time() > keys[j].Time()
	})

	for _, k := range keys {
		// Once ULID time crosses the cutoff, no remaining candidate can satisfy.
		if ulid.Time(k.Time()).Before(notOlderThan) {
			return ulid.ULID{}, nil, nil
		}

		meta, err := store.GetIndexMeta(ctx, ns, k)
		if err != nil {
			if errors.Is(err, ErrSnapshotNotFound) || errors.Is(err, ErrInvalidManifest) {
				continue
			}
			return ulid.ULID{}, nil, fmt.Errorf("reading manifest for %s: %w", k, err)
		}

		if meta.BuildVersion == runningVersion && isFresh(meta) {
			return k, meta, nil
		}
	}

	return ulid.ULID{}, nil, nil
}

// Outcome labels for the IndexSnapshotColdStarts metric.
const (
	coldStartOutcomeAcquiredLock        = "acquired_lock"
	coldStartOutcomeDownloadedAfterWait = "downloaded_after_wait"
	coldStartOutcomeWaitTimedOut        = "wait_timed_out"
	coldStartOutcomeLockError           = "lock_error"
	coldStartOutcomeContextCanceled     = "context_canceled"
)

// Wait-for-leader timing. Package-level vars so tests can shrink them.
var (
	coldStartPollInterval = 30 * time.Second
	coldStartTotalWait    = 15 * time.Minute
)

// coordinateColdStartBuild coordinates from-scratch index builds across
// same-version replicas. Called when BuildIndex has no usable local index
// and the tiered remote selection found nothing.
//
// Outcomes:
//   - (idx, name, rv, nil, nil) -- another replica's snapshot was downloaded; caller skips build.
//   - (nil, "", 0, lock, nil)   -- caller is the leader; build, upload immediately, then release lock.
//   - (nil, "", 0, nil, nil)    --  no snapshot and no leader slot in time; caller builds alone.
//   - (nil, "", 0, nil, err)    -- context canceled mid-coordination.
//
// Each iteration, up to coldStartTotalWait:
//  1. Probe for a usable same-version snapshot. If found, download it.
//  2. Try to acquire LockBuildIndex (no waiting). If acquired, return as
//     leader (lock held for the whole build).
//  3. Wait coldStartPollInterval and try again.
//
// Probe runs before tryAcquire so that we download a leader's just-
// uploaded snapshot instead of becoming a duplicate leader after the
// leader releases the lock (the leader uploads then releases; by the
// time the lock is free the snapshot is in the store).
//
// The lock prevents duplicate expensive builds but is not a correctness
// primitive: lock loss, leader death, or wait timeout all degrade to
// duplicate work. ULID-keyed snapshots are immutable and cleanup reaps
// duplicates.
func (b *bleveBackend) coordinateColdStartBuild(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	lastImportTime time.Time,
	logger log.Logger,
) (_ bleve.Index, _ string, _ int64, _ IndexStoreLock, retErr error) {
	ctx, span := tracer.Start(ctx, "search.remote_index_snapshot.cold_start")
	start := time.Now()
	outcome := coldStartOutcomeWaitTimedOut
	defer func() {
		span.SetAttributes(
			attribute.String("namespace", key.Namespace),
			attribute.String("group", key.Group),
			attribute.String("resource", key.Resource),
			attribute.String("outcome", outcome),
		)
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		b.recordColdStartOutcome(outcome)
		logger.Info("Cold-start coordination completed", "elapsed", time.Since(start), "outcome", outcome)
		span.End()
	}()
	// Probe freshness window: Snapshot.MaxIndexAge, the same hard age
	// filter the tiered selection applies. We don't reuse the rebuild
	// path's tighter maxFreshSnapshotAge — on a cold start any
	// same-version snapshot beats rebuilding, so we want the loosest
	// threshold. Zero means "no age limit": the probe still runs and
	// accepts any same-version snapshot.
	probeMaxAge := b.opts.Snapshot.MaxIndexAge
	logger.Info("Cold-start coordination started", "probe_max_age", probeMaxAge, "last_import_time", lastImportTime)

	ticker := time.NewTicker(coldStartPollInterval)
	defer ticker.Stop()
	deadline := time.NewTimer(coldStartTotalWait)
	defer deadline.Stop()

	for {
		idx, name, rv, err := b.tryDownloadColdStartSnapshot(ctx, key, resourceDir, lastImportTime, probeMaxAge, logger)
		if err != nil {
			outcome = coldStartOutcomeContextCanceled
			return nil, "", 0, nil, err
		}
		if idx != nil {
			outcome = coldStartOutcomeDownloadedAfterWait
			return idx, name, rv, nil, nil
		}

		lock, err := b.opts.Snapshot.Store.LockBuildIndex(ctx, key, b.opts.BuildVersion)
		switch {
		case err == nil:
			outcome = coldStartOutcomeAcquiredLock
			return nil, "", 0, lock, nil
		case errors.Is(err, errLockHeld):
			// keep waiting
		default:
			// Propagate context cancellation so callers can abort cleanly
			// instead of falling through to a from-scratch build.
			if ctxErr := ctx.Err(); ctxErr != nil {
				outcome = coldStartOutcomeContextCanceled
				return nil, "", 0, nil, ctxErr
			}
			logger.Warn("Cold-start lock acquire failed; will build alone", "err", err)
			outcome = coldStartOutcomeLockError
			return nil, "", 0, nil, nil
		}

		select {
		case <-ctx.Done():
			outcome = coldStartOutcomeContextCanceled
			return nil, "", 0, nil, ctx.Err()
		case <-deadline.C:
			outcome = coldStartOutcomeWaitTimedOut
			return nil, "", 0, nil, nil
		case <-ticker.C:
		}
	}
}

// tryDownloadColdStartSnapshot checks whether a usable same-version
// snapshot already exists in the remote index store, and downloads it if
// so. Called once per iteration of coordinateColdStartBuild's loop.
//
//   - idx != nil: snapshot downloaded and returned.
//   - idx == nil, err == nil: no usable snapshot right now.
//   - err != nil: only ctx.Err() is propagated. List/get/download failures
//     are logged and treated as "no hit" — this lookup is an optimisation,
//     not a correctness check.
//
// probeMaxAge <= 0 means "no age limit" — the probe walks the namespace
// and accepts any same-version snapshot.
func (b *bleveBackend) tryDownloadColdStartSnapshot(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	lastImportTime time.Time,
	probeMaxAge time.Duration,
	logger log.Logger,
) (bleve.Index, string, int64, error) {
	idx, name, rv, err := b.tryDownloadFreshSameVersionSnapshot(
		ctx, key, resourceDir, lastImportTime, probeMaxAge,
		snapshotPolicyColdStart, "search.remote_index_snapshot.download_cold_start",
		logger,
	)
	if err != nil {
		// Probe is an optimisation — list/get errors shouldn't abort
		// coordination. Surface ctx.Err() so the wait loop exits promptly,
		// but treat everything else as "no hit".
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, "", 0, ctxErr
		}
		logger.Warn("Cold-start probe failed; will keep coordinating", "err", err)
		return nil, "", 0, nil
	}
	return idx, name, rv, nil
}

func (b *bleveBackend) recordColdStartOutcome(outcome string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotColdStarts.WithLabelValues(outcome).Inc()
}

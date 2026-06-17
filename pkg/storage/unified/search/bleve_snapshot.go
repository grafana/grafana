package search

import (
	"context"
	"errors"
	"fmt"
	"os"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/oklog/ulid/v2"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const zapSegmentType = "zap"

func maxSupportedIndexFormat() string {
	versions := scorch.SupportedSegmentTypeVersions(zapSegmentType)
	if len(versions) == 0 {
		return ""
	}
	return indexFormat(zapSegmentType, slices.Max(versions))
}

func indexFormat(formatType string, version uint32) string {
	if formatType == "" || version == 0 {
		return ""
	}
	return fmt.Sprintf("%s/%d", formatType, version)
}

func parseIndexFormat(format string) (string, uint32, bool) {
	formatType, versionString, ok := strings.Cut(format, "/")
	if !ok || formatType == "" {
		return "", 0, false
	}
	version, err := strconv.ParseUint(versionString, 10, 32)
	if err != nil || version == 0 {
		return "", 0, false
	}
	return formatType, uint32(version), true
}

// isSnapshotIndexFormatUnknownOrSupported treats unknown formats as supported
// for legacy snapshots uploaded before IndexFormat was added to the manifest.
func isSnapshotIndexFormatUnknownOrSupported(snapshotFormat, maxSupportedFormat string) bool {
	if snapshotFormat == "" || maxSupportedFormat == "" {
		return true
	}
	snapshotType, snapshotVersion, ok := parseIndexFormat(snapshotFormat)
	maxSupportedType, maxSupportedVersion, maxOK := parseIndexFormat(maxSupportedFormat)
	return ok && maxOK && snapshotType == maxSupportedType && snapshotVersion <= maxSupportedVersion
}

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
			all, err := ListIndexSnapshots(ctx, b.opts.Snapshot.Store, key, logger)
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
			k, m, err := findFreshSnapshotByBuildStart(ctx, b.opts.Snapshot.Store, key, notOlderThan, b.opts.BuildVersion, b.maxSupportedIndexFormat, logger)
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
				attribute.String("snapshot_index_format", meta.IndexFormat),
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
		"snapshot_index_format", meta.IndexFormat,
		"snapshot_rv", meta.LatestResourceVersion,
		"snapshot_uploaded", meta.UploadTimestamp,
	}
	if !meta.BuildTime.IsZero() {
		logFields = append(logFields, "snapshot_build_time", meta.BuildTime)
	}
	logger = logger.New(logFields...)

	// Pick and reserve a fresh destination directory name. DownloadIndexSnapshot
	// refuses to overwrite an existing destDir, so reserveIndexDir protects the
	// not-yet-created path from other in-process builds while we download.
	destDir, name, err := b.reserveIndexDir(resourceDir)
	if err != nil {
		outcome = snapshotStatusDownloadError
		return nil, "", 0, fmt.Errorf("reserving local snapshot dir: %w", err)
	}

	// On success, ownership of the reservation transfers to the caller
	// (BuildIndex unregisters via its own defer); on any failure path below,
	// this defer releases it.
	defer func() {
		if retErr != nil {
			b.unregisterInFlightBuildDir(destDir)
		}
	}()

	downloadStart := time.Now()
	downloadedMeta, err := DownloadIndexSnapshot(ctx, b.opts.Snapshot.Store, key, snapKey, destDir)
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

// pickBestSnapshot applies hard filters (upload time, index format,
// unparseable version) and the three-tier preference to pick the best
// snapshot, if any.
//
// Tier 0 (ideal): MinBuildVersion <= v <= runningVersion
// Tier 1 (older, acceptable): v < MinBuildVersion
// Tier 2 (newer, last resort): v > runningVersion
//
// Within each tier, sort by version desc -> RV desc -> upload time desc.
func (b *bleveBackend) pickBestSnapshot(all map[ulid.ULID]*IndexMeta, notOlderThan time.Time, logger log.Logger) (snapshotCandidate, bool) {
	minVersion := b.opts.Snapshot.MinBuildVersion
	running := b.runningBuildVersion

	var droppedAge, droppedUnparseable, droppedFormatUnsupported int
	candidates := make([]snapshotCandidate, 0, len(all))
	for k, m := range all {
		// Hard filter: age.
		if !notOlderThan.IsZero() && m.UploadTimestamp.Before(notOlderThan) {
			droppedAge++
			continue
		}
		if !isSnapshotIndexFormatUnknownOrSupported(m.IndexFormat, b.maxSupportedIndexFormat) {
			droppedFormatUnsupported++
			logger.Debug("index snapshot candidate dropped: unsupported format",
				"key", k.String(),
				"snapshot_format", m.IndexFormat,
				"max_supported_format", b.maxSupportedIndexFormat,
				"version", m.BuildVersion,
				"rv", m.LatestResourceVersion,
				"uploaded", m.UploadTimestamp,
			)
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
			"snapshot_format", c.meta.IndexFormat,
			"max_supported_format", b.maxSupportedIndexFormat,
			"rv", c.meta.LatestResourceVersion,
			"uploaded", c.meta.UploadTimestamp,
		)
	}

	if len(candidates) == 0 {
		logger.Debug("no index snapshot candidates", "total", len(all), "dropped_age", droppedAge, "dropped_unparseable", droppedUnparseable, "dropped_format_unsupported", droppedFormatUnsupported, "max_supported_format", b.maxSupportedIndexFormat)
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
		"snapshot_format", candidates[0].meta.IndexFormat,
		"max_supported_format", b.maxSupportedIndexFormat,
		"candidates", len(candidates),
		"dropped_age", droppedAge,
		"dropped_unparseable", droppedUnparseable,
		"dropped_format_unsupported", droppedFormatUnsupported,
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
// returns the first one whose BuildVersion matches runningVersion, whose
// index format is not newer than this process can support, and whose ULID time
// is after notOlderThan. Returns a zero key and nil meta when no such snapshot exists.
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
	maxSupportedIndexFormat string,
	logger log.Logger,
) (ulid.ULID, *IndexMeta, error) {
	return findFreshSnapshot(ctx, store, ns, notOlderThan, runningVersion, maxSupportedIndexFormat, logger, func(*IndexMeta) bool {
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
	maxSupportedIndexFormat string,
	logger log.Logger,
) (ulid.ULID, *IndexMeta, error) {
	return findFreshSnapshot(ctx, store, ns, notOlderThan, runningVersion, maxSupportedIndexFormat, logger, func(meta *IndexMeta) bool {
		return !meta.BuildTime.IsZero() && meta.BuildTime.After(notOlderThan)
	})
}

func findFreshSnapshot(
	ctx context.Context,
	store RemoteIndexStore,
	ns resource.NamespacedResource,
	notOlderThan time.Time,
	runningVersion string,
	maxSupportedIndexFormat string,
	logger log.Logger,
	isFresh func(*IndexMeta) bool,
) (ulid.ULID, *IndexMeta, error) {
	keys, err := retryRemoteIndexStoreValue(ctx, snapshotStoreOpListIndexKeys, nil, func() ([]ulid.ULID, error) {
		return store.ListIndexKeys(ctx, ns)
	})
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

		meta, err := ReadIndexSnapshotManifest(ctx, store, ns, k)
		if err != nil {
			if errors.Is(err, ErrSnapshotNotFound) || errors.Is(err, ErrInvalidManifest) {
				continue
			}
			return ulid.ULID{}, nil, fmt.Errorf("reading manifest for %s: %w", k, err)
		}

		if !isSnapshotIndexFormatUnknownOrSupported(meta.IndexFormat, maxSupportedIndexFormat) {
			logger.Debug("index snapshot candidate dropped: unsupported format",
				"key", k.String(),
				"snapshot_format", meta.IndexFormat,
				"max_supported_format", maxSupportedIndexFormat,
				"version", meta.BuildVersion,
			)
			continue
		}

		if meta.BuildVersion == runningVersion && isFresh(meta) {
			return k, meta, nil
		}
	}

	return ulid.ULID{}, nil, nil
}

const (
	snapshotBuildFlowColdStart = "cold_start"
	snapshotBuildFlowRebuild   = "rebuild"
)

// Outcome labels for the IndexSnapshotBuildCoordinations metric and the
// coordination span. Kept compatible with the metric label values.
const (
	snapshotBuildOutcomeAcquiredLock        = "acquired_lock"
	snapshotBuildOutcomeDownloadedAfterWait = "downloaded_after_wait"
	snapshotBuildOutcomeWaitTimedOut        = "wait_timed_out"
	snapshotBuildOutcomeLockError           = "lock_error"
	snapshotBuildOutcomeContextCanceled     = "context_canceled"
)

// Wait-for-leader timing. Package-level vars so tests can shrink them.
var (
	snapshotBuildPollInterval = 30 * time.Second
	coldStartTotalWait        = 15 * time.Minute
)

// snapshotBuildCoordinationOpts configures coordinateSnapshotBuild.
type snapshotBuildCoordinationOpts struct {
	// flow identifies the caller for logs and span attributes.
	flow string
	// spanName is the tracer span name for the coordination loop.
	spanName string
	// pollInterval is how long to wait between probe/lock attempts.
	pollInterval time.Duration
	// totalWait caps how long to wait for a leader before giving up. Zero
	// means "wait until ctx cancellation": used by the rebuild path where
	// an existing index is already serving search, so waiting indefinitely
	// is preferable to running a duplicate rebuild.
	totalWait time.Duration
	// probe is called once per iteration to look for an acceptable same-
	// version snapshot. Probe errors other than ctx cancellation should be
	// swallowed and returned as (nil, "", 0, nil).
	probe func(ctx context.Context) (bleve.Index, string, int64, error)
	// recordOutcome is invoked once after the loop returns. May be nil.
	recordOutcome func(outcome string)
}

// coordinateSnapshotBuild coordinates from-scratch index builds across same-
// version replicas using the existing remote build lock. Shared between the
// cold-start path (no usable local index) and the periodic rebuild path.
//
// Outcomes:
//   - idx != nil:           another replica's snapshot was downloaded; caller skips build.
//   - lock != nil:          caller is the leader; build, upload immediately, then release lock.
//   - both nil, err == nil: lock backend failed or wait timed out; caller builds alone.
//   - err != nil:           context canceled mid-coordination.
//
// Error contract: coordination is best-effort. Only context cancellation is
// returned to the caller. Probe failures (list/download/manifest read) and
// non-contention lock backend failures are logged and converted to outcomes
// ("lock_error", "wait_timed_out", ...) on the IndexSnapshotBuildCoordinations
// metric, then the caller is told to build alone or to keep waiting. This
// keeps callers simple: a flaky storage or lock backend should never fail an
// index build, just degrade coordination quality. For debugging, inspect the
// warn logs from this function and from the probe helpers, plus the metric.
//
// Each iteration:
//  1. Probe for a usable same-version snapshot. If found, download it.
//  2. Try to acquire LockBuildIndex (no waiting). If acquired, return as
//     leader (lock held for the whole build).
//  3. Wait pollInterval and try again, until totalWait elapses or ctx is canceled.
//
// Probe runs before tryAcquire so that we download a leader's just-uploaded
// snapshot instead of becoming a duplicate leader after the leader releases
// the lock (the leader uploads then releases; by the time the lock is free the
// snapshot is in the store).
//
// The lock prevents duplicate expensive builds but is not a correctness
// primitive: lock loss, leader death, or wait timeout all degrade to duplicate
// work. ULID-keyed snapshots are immutable and cleanup reaps duplicates.
func (b *bleveBackend) coordinateSnapshotBuild(
	ctx context.Context,
	key resource.NamespacedResource,
	opts snapshotBuildCoordinationOpts,
	logger log.Logger,
) (_ bleve.Index, _ string, _ int64, _ IndexStoreLock, retErr error) {
	ctx, span := tracer.Start(ctx, opts.spanName)
	start := time.Now()
	outcome := snapshotBuildOutcomeWaitTimedOut
	defer func() {
		span.SetAttributes(
			attribute.String("namespace", key.Namespace),
			attribute.String("group", key.Group),
			attribute.String("resource", key.Resource),
			attribute.String("flow", opts.flow),
			attribute.String("outcome", outcome),
		)
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		if opts.recordOutcome != nil {
			opts.recordOutcome(outcome)
		}
		logger.Info("Snapshot build coordination completed",
			"flow", opts.flow, "elapsed", time.Since(start), "outcome", outcome)
		span.End()
	}()

	logger.Info("Snapshot build coordination started",
		"flow", opts.flow,
		"poll_interval", opts.pollInterval,
		"total_wait", opts.totalWait,
	)

	ticker := time.NewTicker(opts.pollInterval)
	defer ticker.Stop()
	var deadlineC <-chan time.Time
	if opts.totalWait > 0 {
		deadline := time.NewTimer(opts.totalWait)
		defer deadline.Stop()
		deadlineC = deadline.C
	}

	for {
		idx, name, rv, err := opts.probe(ctx)
		if err != nil {
			outcome = snapshotBuildOutcomeContextCanceled
			return nil, "", 0, nil, err
		}
		if idx != nil {
			outcome = snapshotBuildOutcomeDownloadedAfterWait
			return idx, name, rv, nil, nil
		}

		lock, err := b.opts.Snapshot.Store.LockBuildIndex(ctx, key, b.opts.BuildVersion)
		switch {
		case err == nil:
			outcome = snapshotBuildOutcomeAcquiredLock
			return nil, "", 0, lock, nil
		case errors.Is(err, errLockHeld):
			// keep waiting
		default:
			// Propagate context cancellation so callers can abort cleanly
			// instead of falling through to a from-scratch build.
			if ctxErr := ctx.Err(); ctxErr != nil {
				outcome = snapshotBuildOutcomeContextCanceled
				return nil, "", 0, nil, ctxErr
			}
			logger.Warn("Snapshot build coordination lock acquire failed; will build alone",
				"flow", opts.flow, "err", err)
			outcome = snapshotBuildOutcomeLockError
			return nil, "", 0, nil, nil
		}

		select {
		case <-ctx.Done():
			outcome = snapshotBuildOutcomeContextCanceled
			return nil, "", 0, nil, ctx.Err()
		case <-deadlineC:
			// deadlineC is nil when totalWait == 0; this branch never fires in that case.
			outcome = snapshotBuildOutcomeWaitTimedOut
			return nil, "", 0, nil, nil
		case <-ticker.C:
		}
	}
}

// coordinateColdStartBuild coordinates from-scratch index builds across
// same-version replicas. Called when BuildIndex has no usable local index
// and the tiered remote selection found nothing.
func (b *bleveBackend) coordinateColdStartBuild(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	lastImportTime time.Time,
	logger log.Logger,
) (bleve.Index, string, int64, IndexStoreLock, error) {
	// Probe freshness window: Snapshot.MaxIndexAge, the same hard age filter
	// the tiered selection applies. We don't reuse the rebuild path's tighter
	// maxFreshSnapshotAge — on a cold start any same-version snapshot beats
	// rebuilding, so we want the loosest threshold. Zero means "no age limit":
	// the probe still runs and accepts any same-version snapshot.
	probeMaxAge := b.opts.Snapshot.MaxIndexAge
	return b.coordinateSnapshotBuild(ctx, key, snapshotBuildCoordinationOpts{
		flow:         snapshotBuildFlowColdStart,
		spanName:     "search.remote_index_snapshot.cold_start",
		pollInterval: snapshotBuildPollInterval,
		totalWait:    coldStartTotalWait,
		probe: func(ctx context.Context) (bleve.Index, string, int64, error) {
			return b.tryDownloadColdStartSnapshot(ctx, key, resourceDir, lastImportTime, probeMaxAge, logger)
		},
		recordOutcome: func(outcome string) {
			b.recordBuildCoordinationOutcome(snapshotBuildFlowColdStart, outcome)
		},
	}, logger)
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

// coordinateRebuild coordinates periodic rebuilds across same-version replicas.
// It uses the same remote build lock as cold-start coordination, but probes
// with the rebuild freshness window so waiting replicas only accept snapshots
// fresh enough to satisfy the rebuild condition. The rebuild path passes no
// totalWait: the existing index is still serving search, so waiting for a
// leader is preferable to running a duplicate rebuild.
func (b *bleveBackend) coordinateRebuild(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	lastImportTime time.Time,
	maxFreshSnapshotAge time.Duration,
	logger log.Logger,
) (bleve.Index, string, int64, IndexStoreLock, error) {
	return b.coordinateSnapshotBuild(ctx, key, snapshotBuildCoordinationOpts{
		flow:         snapshotBuildFlowRebuild,
		spanName:     "search.remote_index_snapshot.rebuild_coordination",
		pollInterval: snapshotBuildPollInterval,
		probe: func(ctx context.Context) (bleve.Index, string, int64, error) {
			return b.tryDownloadRebuildSnapshot(ctx, key, resourceDir, lastImportTime, maxFreshSnapshotAge, logger)
		},
		recordOutcome: func(outcome string) {
			b.recordBuildCoordinationOutcome(snapshotBuildFlowRebuild, outcome)
		},
	}, logger)
}

// tryDownloadRebuildSnapshot checks whether a fresh same-version snapshot
// exists for the rebuild path, and downloads it if so. Probe failures are
// treated as "no hit" so coordination can still elect a leader and rebuild;
// only context cancellation aborts the loop.
func (b *bleveBackend) tryDownloadRebuildSnapshot(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	lastImportTime time.Time,
	maxFreshSnapshotAge time.Duration,
	logger log.Logger,
) (bleve.Index, string, int64, error) {
	idx, name, rv, err := b.tryDownloadFreshSameVersionSnapshot(
		ctx, key, resourceDir, lastImportTime, maxFreshSnapshotAge,
		snapshotPolicySameVersion, "search.remote_index_snapshot.download_fresh",
		logger,
	)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, "", 0, ctxErr
		}
		logger.Warn("Rebuild coordination probe failed; will keep coordinating", "err", err)
		return nil, "", 0, nil
	}
	return idx, name, rv, nil
}

func (b *bleveBackend) recordBuildCoordinationOutcome(flow, outcome string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotBuildCoordinations.WithLabelValues(flow, outcome).Inc()
}

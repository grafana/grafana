package backfill

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/foldertitle"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/search/embed/backfill")

const backfillPageSize = 100

// dashboardGroup / dashboardResource gate the views filter to dashboard
// builders; the filter is a no-op for any other resource type.
const (
	dashboardGroup    = "dashboard.grafana.app"
	dashboardResource = "dashboards"
)

// viewsLast30DaysKey matches pkg/extensions/usageinsights.statsToMap.
const viewsLast30DaysKey = "views_last_30_days"

type Options struct {
	Storage       resource.StorageBackend
	VectorBackend vector.VectorBackend
	BatchEmbedder *embedder.BatchEmbedder
	Builders      []embed.Builder
	// DashboardStats is optional; nil disables the views filter.
	DashboardStats builders.DashboardStats
	// Metrics is optional; when nil the backfiller runs without
	// observability instrumentation (handy for unit tests).
	Metrics *resource.VectorMetrics
	// Interval is how often Run re-scans for incomplete jobs (jobs are
	// created lazily by the reconciler's write path). Defaults to 1m.
	Interval time.Duration
}

type VectorBackfiller struct {
	storage       resource.StorageBackend
	vectorBackend vector.VectorBackend
	batchEmbedder *embedder.BatchEmbedder
	builders      map[string]embed.Builder
	// sortedBuilders is builders sorted by Resource() so iteration order
	// is stable across pod restarts. Precomputed because the set is
	// immutable after construction.
	sortedBuilders []embed.Builder
	dashboardStats builders.DashboardStats
	log            log.Logger
	metrics        *resource.VectorMetrics
	interval       time.Duration

	folderTitleResolver *foldertitle.Resolver
	folderTitleCache    map[string]string
}

const defaultBackfillInterval = time.Minute

func NewVectorBackfiller(opts Options) (*VectorBackfiller, error) {
	if opts.Storage == nil {
		return nil, fmt.Errorf("backfill: Storage is required")
	}
	if opts.VectorBackend == nil {
		return nil, fmt.Errorf("backfill: VectorBackend is required")
	}
	if opts.BatchEmbedder == nil {
		return nil, fmt.Errorf("backfill: BatchEmbedder is required")
	}
	if len(opts.Builders) == 0 {
		return nil, fmt.Errorf("backfill: at least one Builder is required")
	}

	builders := make(map[string]embed.Builder, len(opts.Builders))
	for _, b := range opts.Builders {
		r := b.Resource()
		if _, dup := builders[r]; dup {
			return nil, fmt.Errorf("backfill: duplicate builder for resource %q", r)
		}
		builders[r] = b
	}
	keys := make([]string, 0, len(builders))
	for k := range builders {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	sorted := make([]embed.Builder, 0, len(builders))
	for _, k := range keys {
		sorted = append(sorted, builders[k])
	}

	interval := opts.Interval
	if interval <= 0 {
		interval = defaultBackfillInterval
	}

	return &VectorBackfiller{
		storage:             opts.Storage,
		vectorBackend:       opts.VectorBackend,
		batchEmbedder:       opts.BatchEmbedder,
		builders:            builders,
		sortedBuilders:      sorted,
		dashboardStats:      opts.DashboardStats,
		log:                 log.New("backfill"),
		metrics:             opts.Metrics,
		interval:            interval,
		folderTitleResolver: foldertitle.NewResolver(opts.Storage),
	}, nil
}

// Run acquires a Postgres advisory lock so only one process backfills, then
// drains incomplete jobs immediately and on every interval tick. The periodic
// re-scan picks up new jobs from the reconciler.
func (b *VectorBackfiller) Run(ctx context.Context) error {
	release, acquired, err := b.vectorBackend.TryAcquireBackfillLock(ctx)
	if err != nil {
		return fmt.Errorf("backfill: acquire lock: %w", err)
	}
	if !acquired {
		b.log.Info("backfill: lock already held; skipping")
		return nil
	}
	defer release()

	b.runBackfill(ctx)
	t := time.NewTicker(b.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
			b.runBackfill(ctx)
		}
	}
}

// runBackfill processes every incomplete vector_backfill_jobs row serially.
func (b *VectorBackfiller) runBackfill(ctx context.Context) {
	log := b.log.FromContext(ctx)

	b.reopenStaleJobs(ctx, log)

	jobs, err := b.vectorBackend.ListIncompleteBackfillJobs(ctx, b.batchEmbedder.Model())
	if err != nil {
		log.Error("backfill: list jobs", "err", err)
		return
	}
	if len(jobs) == 0 {
		return
	}

	log.Info("backfill: starting", "jobs", len(jobs))
	for _, job := range jobs {
		if ctx.Err() != nil {
			return
		}
		// we dont have the builder yet - skip it and dont mark complete
		if job.Resource != "" && !b.hasBuilderForResource(job.Resource) {
			log.Info("backfill: skipping job for unregistered resource",
				"job_id", job.ID, "job_resource", job.Resource)
			continue
		}
		if err := b.runBackfillJob(ctx, job); err != nil {
			log.Error("backfill: job failed",
				"job_id", job.ID, "model", job.Model, "err", err)
			_ = b.vectorBackend.MarkBackfillJobError(ctx, job.ID, err.Error())
			continue
		}
		if err := b.vectorBackend.CompleteBackfillJob(ctx, job.ID); err != nil {
			log.Error("backfill: complete job", "job_id", job.ID, "err", err)
		} else {
			log.Info("backfill: job complete", "job_id", job.ID, "model", job.Model)
		}
	}
}

// reopenStaleJobs runs before the incomplete-jobs list so a version-bump reopen is drained on the same tick; per-builder failures don't block the tick.
func (b *VectorBackfiller) reopenStaleJobs(ctx context.Context, log log.Logger) {
	// The reconciler checkpoint is a real observed RV, so every row processed
	// before the reopen sorts below it — a wall-clock snowflake would not
	// (node/sequence bits, clock skew). Zero means the reconciler has never
	// written, so there is nothing stale to reopen yet.
	stoppingRV, err := b.vectorBackend.GetLatestRV(ctx)
	if err != nil {
		log.Error("backfill: read reconciler checkpoint for reopen", "err", err)
		return
	}
	if stoppingRV == 0 {
		return
	}
	for _, builder := range b.sortedBuilders {
		reopened, err := b.vectorBackend.ReopenStaleBackfillJobs(ctx, b.batchEmbedder.Model(), builder.Resource(), builder.Version(), stoppingRV)
		if err != nil {
			log.Error("backfill: reopen stale jobs", "resource", builder.Resource(), "err", err)
			continue
		}
		if reopened {
			log.Info("backfill: reopened stale job for content version bump",
				"resource", builder.Resource(), "version", builder.Version())
		}
	}
}

// runBackfillJob iterates registered Builders for the job. When job.Resource is empty is means all builders.
// Builders are processed in deterministic resource-name order; each one gets its own paginated cross-namespace scan.
// last_seen_key contains the continue token and the resource name so we know which builder to resume from.
func (b *VectorBackfiller) runBackfillJob(ctx context.Context, job vector.BackfillJob) error {
	// Fresh title cache per job run; titles aren't carried across runs.
	b.folderTitleCache = make(map[string]string)

	// Decode cursor to see if we need to resume
	cursor, err := decodeCursor(job.LastSeenKey)
	if err != nil {
		b.log.Warn("backfill: cursor decode failed; starting from scratch",
			"job_id", job.ID, "err", err)
		cursor = jobCursor{}
	}
	if cursor.Resource != "" && !b.hasBuilderForResource(cursor.Resource) {
		b.log.Warn("backfill: cursor refers to unknown resource; starting from scratch",
			"job_id", job.ID, "cursor_resource", cursor.Resource)
		cursor = jobCursor{}
	}

	for _, builder := range b.sortedBuilders {
		// Job-level resource filter: empty means "all Builders," non-empty
		// targets exactly that Builder.
		if job.Resource != "" && builder.Resource() != job.Resource {
			continue
		}
		// Cursor-level resume: skip Builders sorted before the cursor's
		// Resource since they completed in the prior run.
		if cursor.Resource != "" && builder.Resource() != cursor.Resource {
			continue
		}
		pageToken := cursor.Token
		for {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			var err error
			pageToken, err = b.runBackfillPage(ctx, job, builder, pageToken)
			if err != nil {
				return err
			}
			if pageToken == "" {
				break
			}
		}
		// Cursor (if any) has now been consumed by the matching Builder.
		// Subsequent Builders run from scratch.
		cursor = jobCursor{}
	}
	return nil
}

func (b *VectorBackfiller) hasBuilderForResource(resource string) bool {
	_, ok := b.builders[resource]
	return ok
}

// runBackfillPage processes up to backfillPageSize items. Returns the
// next-page token; empty when the iterator exhausted (no more pages).
func (b *VectorBackfiller) runBackfillPage(ctx context.Context, job vector.BackfillJob, builder embed.Builder, pageToken string) (string, error) {
	req := &resourcepb.ListRequest{
		Limit:           backfillPageSize,
		NextPageToken:   pageToken,
		ResourceVersion: job.StoppingRV,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:    builder.Group(),
				Resource: builder.Resource(),
				// Empty namespace → cross-namespace listing.
			},
		},
	}

	var (
		processed  int
		pendingTok string // continue token from prior processed item; peek not yet confirmed
		nextToken  string // last confirmed-valid token
		hasMore    bool   // set when a size+1 Next()==true confirms another page exists
	)
	_, err := b.storage.ListIterator(ctx, req, func(iter resource.ListIterator) error {
		for iter.Next() {
			if iterErr := iter.Error(); iterErr != nil {
				return iterErr
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			// Another Next()==true confirms the prior item's peek
			// pointed at a real row. Promote pendingTok and persist it.
			if pendingTok != "" {
				encoded := encodeCursor(builder.Resource(), pendingTok)
				if cerr := b.vectorBackend.UpdateBackfillJobCheckpoint(ctx, job.ID, encoded, ""); cerr != nil {
					return fmt.Errorf("checkpoint: %w", cerr)
				}
				nextToken = pendingTok
				pendingTok = ""
			}
			if processed == backfillPageSize {
				// We took an extra Next()==true past the page; that's
				// the proof there's another page worth requesting.
				hasMore = true
				return nil
			}
			if err := b.processBackfillItem(ctx, job, builder, iter); err != nil {
				return err
			}
			processed++
			pendingTok = iter.ContinueToken()
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if !hasMore {
		return "", nil
	}
	return nextToken, nil
}

// isPermanentItemError reports whether the item's own content caused the
// failure, so retrying can never succeed. Provider rejections stay retryable
// because misconfig produces the same codes.
func isPermanentItemError(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	// SQLSTATE class 22 = data exception, e.g. NUL byte in text. Class 23
	// is excluded: missing partitions surface as 23514 check_violation.
	var pgxErr *pgconn.PgError
	if errors.As(err, &pgxErr) {
		return strings.HasPrefix(pgxErr.Code, "22")
	}
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code.Class() == "22"
	}
	return false
}

// skipPermanentItem logs an unfixable item being skipped so it can't wedge the job.
func (b *VectorBackfiller) skipPermanentItem(stage, namespace, group, res, name string, err error) {
	b.log.Warn("backfill: permanent error; skipping item",
		"stage", stage, "namespace", namespace, "group", group, "resource", res, "name", name, "err", err)
}

// processBackfillItem runs the per-resource pipeline: skip if RV>stopping_rv
// or already embedded, else extract → embed → upsert.
func (b *VectorBackfiller) processBackfillItem(ctx context.Context, job vector.BackfillJob, builder embed.Builder, iter resource.ListIterator) (retErr error) {
	ctx, span := tracer.Start(ctx, "unified.backfill.processBackfillItem")
	defer span.End()

	namespace := iter.Namespace()
	name := iter.Name()
	group := builder.Group()
	res := builder.Resource()
	span.SetAttributes(
		attribute.String("group", group),
		attribute.String("resource", res),
		attribute.String("namespace", namespace),
		attribute.String("uid", name),
	)

	start := time.Now()
	statusLabel := "embedded"
	defer func() {
		if retErr != nil {
			statusLabel = "error"
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		if b.metrics != nil {
			metricutil.ObserveWithExemplar(ctx,
				b.metrics.BackfillItemDuration.WithLabelValues(group, res, statusLabel),
				time.Since(start).Seconds(),
			)
		}
	}()

	rv := iter.ResourceVersion()
	// Compare in snowflake space so the bound holds whether the item RV and
	// the stored stopping_rv came from the kv (snowflake) or legacy sql
	// (microsecond) backend — e.g. after a SQL<->KV backend swap.
	if resource.ToSnowflakeRV(rv) > resource.ToSnowflakeRV(job.StoppingRV) {
		statusLabel = "skipped_rv_past_stopping"
		return nil
	}

	// Same-or-newer stored version: nothing to do.
	version, exists, err := b.vectorBackend.ContentVersion(ctx, namespace, job.Model, res, name)
	if err != nil {
		return fmt.Errorf("content version check: %w", err)
	}
	if exists && version >= builder.Version() {
		statusLabel = "skipped_already_embedded"
		return nil
	}
	// Only version-stale uids get the identical-content check; new uids have nothing to compare.
	isVersionStale := exists && version < builder.Version()

	if embed.HasPendingDeleteLabel(iter.Value()) {
		statusLabel = "skipped_pending_delete"
		return nil
	}

	// Zero views only gates NEW embeds; already-embedded dashboards stay embedded and current.
	if !exists && b.shouldSkipForZeroViews(ctx, builder, namespace, name) {
		statusLabel = "skipped_zero_views"
		return nil
	}

	key := &resourcepb.ResourceKey{
		Group:     group,
		Resource:  res,
		Namespace: namespace,
		Name:      name,
	}

	// Storage errors fail the job so the next tick retries this item, unlike permanent Extract errors.
	folderTitle, err := b.resolveFolderTitle(ctx, namespace, iter.Value())
	if err != nil {
		return fmt.Errorf("resolve folder title %s/%s: %w", namespace, name, err)
	}

	items, err := builder.Extract(ctx, key, iter.Value(), folderTitle)
	if err != nil {
		// Extract is deterministic over stored bytes; failures are permanent.
		b.skipPermanentItem("extract", namespace, group, res, name, err)
		statusLabel = "skipped_permanent_error"
		return nil
	}
	if resCap := builder.MaxItemsPerResource(); resCap > 0 && len(items) > resCap {
		items = items[:resCap]
	}
	if len(items) == 0 {
		// A version-stale uid whose new extractor output is empty must shed its old rows, like the reconciler's empty-extract path.
		if isVersionStale {
			if outcome, err := b.checkLiveRV(ctx, key, rv); err != nil {
				return err
			} else if outcome.skip {
				statusLabel = outcome.status
				return nil
			}
			if err := b.vectorBackend.Delete(ctx, namespace, job.Model, res, name); err != nil {
				return fmt.Errorf("delete empty extract %s/%s: %w", namespace, name, err)
			}
			statusLabel = "deleted_empty_extract"
			return nil
		}
		statusLabel = "skipped_empty_extract"
		// this shouldn't happen that often. If it does, use this to look up the dashboard json and understand why nothing was extracted.
		b.log.Info("skipping empty extract", "namespace", namespace, "group", group, "resource", res, "name", name)
		return nil
	}

	if isVersionStale {
		stored, _, err := b.vectorBackend.GetSubresourceContent(ctx, namespace, job.Model, res, name)
		if err != nil {
			return fmt.Errorf("get stored content %s/%s: %w", namespace, name, err)
		}
		if identicalContent(stored, items) {
			if err := b.vectorBackend.UpdateContentVersion(ctx, namespace, job.Model, res, name, builder.Version()); err != nil {
				return fmt.Errorf("update content version %s/%s: %w", namespace, name, err)
			}
			statusLabel = "skipped_identical_content"
			return nil
		}
		// Not identical: re-embed everything. Per-panel diffing would strand unchanged rows at the old version and rescan them forever.
	}

	vectors, err := b.batchEmbedder.Embed(ctx, namespace, res, rv, builder.Version(), items)
	if err != nil {
		return fmt.Errorf("embed %s/%s: %w", namespace, name, err)
	}

	// The scanned value may be a minute old (pages process serially) and the
	// reconciler may have embedded a newer revision meanwhile; re-check the
	// live RV just before writing so we don't overwrite it with stale content.
	// Not airtight (the write isn't RV-conditional) but shrinks the race
	// window from the whole page scan to milliseconds.
	if outcome, err := b.checkLiveRV(ctx, key, rv); err != nil {
		return err
	} else if outcome.skip {
		statusLabel = outcome.status
		return nil
	}

	// Replace-with-desired sheds stored rows for panels the extractor no longer produces.
	desired := make([]string, 0, len(items))
	for _, it := range items {
		desired = append(desired, it.Subresource)
	}

	if err := b.vectorBackend.UpsertReplaceSubresources(ctx, namespace, job.Model, res, name, vectors, desired); err != nil {
		if isPermanentItemError(err) {
			b.skipPermanentItem("upsert", namespace, group, res, name, err)
			statusLabel = "skipped_permanent_error"
			return nil
		}
		return fmt.Errorf("upsert %s/%s: %w", namespace, name, err)
	}
	return nil
}

// liveGuardOutcome classifies the pre-write live read: proceed, skip with
// the given status, or retry via error.
type liveGuardOutcome struct {
	skip   bool
	status string
}

// checkLiveRV re-reads the resource just before a destructive write. The
// scanned value can be a page-scan old; skipping when the live state moved
// leaves the newer revision to the reconciler. Not airtight (writes are not
// RV-conditional) but shrinks the race window to milliseconds.
func (b *VectorBackfiller) checkLiveRV(ctx context.Context, key *resourcepb.ResourceKey, scannedRV int64) (liveGuardOutcome, error) {
	resp := b.storage.ReadResource(ctx, &resourcepb.ReadRequest{Key: key})
	switch {
	case resp.Error != nil && resp.Error.Code == http.StatusNotFound:
		// Deleted since the scan; writing would recreate rows the reconciler's
		// delete event already removed, with no later event to clean them up.
		return liveGuardOutcome{skip: true, status: "skipped_deleted"}, nil
	case resp.Error != nil:
		// Transient read failure: retry the item rather than risk a stale write.
		return liveGuardOutcome{}, fmt.Errorf("live read %s/%s: %s", key.Namespace, key.Name, resp.Error.Message)
	case resp.ResourceVersion != scannedRV:
		return liveGuardOutcome{skip: true, status: "skipped_rv_changed"}, nil
	}
	return liveGuardOutcome{}, nil
}

// identicalContent reports whether extracted and stored have the same subresource set and content.
func identicalContent(stored map[string]string, extracted []embed.Item) bool {
	if len(stored) != len(extracted) {
		return false
	}
	for _, it := range extracted {
		v, ok := stored[it.Subresource]
		if !ok || v != it.Content {
			return false
		}
	}
	return true
}

// resolveFolderTitle resolves the value's folder annotation to a title via the per-run cache.
func (b *VectorBackfiller) resolveFolderTitle(ctx context.Context, namespace string, value []byte) (string, error) {
	folderUID := embed.FolderUIDFromValue(value)
	if folderUID == "" {
		return "", nil
	}
	cacheKey := namespace + "/" + folderUID
	if title, ok := b.folderTitleCache[cacheKey]; ok {
		return title, nil
	}
	title, err := b.folderTitleResolver.Title(ctx, namespace, folderUID)
	if err != nil {
		return "", err
	}
	b.folderTitleCache[cacheKey] = title
	return title, nil
}

// shouldSkipForZeroViews returns true only when the stats provider
// definitively reports zero views in the last 30 days for this
// dashboard. Anything ambiguous (nil provider, non-dashboard builder,
// lookup error, missing key) returns false — embed it.
func (b *VectorBackfiller) shouldSkipForZeroViews(ctx context.Context, builder embed.Builder, namespace, name string) bool {
	if b.dashboardStats == nil {
		return false
	}
	if builder.Group() != dashboardGroup || builder.Resource() != dashboardResource {
		return false
	}
	if name == "" || namespace == "" {
		return false
	}
	stats, err := b.dashboardStats.GetDashboardStats(ctx, namespace, name)
	if err != nil {
		b.log.Error("backfiller dashboard stats check failed", "namespace", namespace, "name", name, "err", err)
		return false
	}
	views, ok := stats[viewsLast30DaysKey]
	if !ok {
		return false
	}
	if views > 0 {
		b.log.Info("backfiller embedding dashboard with views in last 30 days", "namespace", namespace, "name", name, "views", views)
		return false
	}
	b.log.FromContext(ctx).Debug("backfill: skipping dashboard with zero views in last 30 days",
		"namespace", namespace, "name", name)
	return true
}

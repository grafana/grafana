package backfill

import (
	"context"
	"errors"
	"fmt"
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
	// folderTitleCache caches namespace+"/"+folderUID -> title for the
	// duration of a single job run. Folders repeat heavily across a scan
	// (many dashboards share a folder), and staleness within one run is
	// harmless since the job re-runs periodically anyway.
	folderTitleCache map[string]string
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

// reopenStaleJobs runs once per tick, before the incomplete-jobs list is
// read, so a job a builder's version bump just reopened is picked up on the
// same tick rather than waiting for the next one. Best-effort per builder: a
// failure for one builder doesn't block the others or the rest of the tick.
func (b *VectorBackfiller) reopenStaleJobs(ctx context.Context, log log.Logger) {
	stoppingRV := resource.ToSnowflakeRV(time.Now().UnixMicro())
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
	// Fresh cache per job run: folders repeat heavily within a single scan,
	// but a job run can span a long time, so we don't carry titles forward
	// into the next run.
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

	// if a same-or-newer version is already embedded, skip; a lower stored
	// version means the builder's content shape moved on and this uid needs
	// re-embedding.
	version, exists, err := b.vectorBackend.ContentVersion(ctx, namespace, job.Model, res, name)
	if err != nil {
		return fmt.Errorf("content version check: %w", err)
	}
	if exists && version >= builder.Version() {
		statusLabel = "skipped_already_embedded"
		return nil
	}
	// isVersionStale gates the identical-content check below: a brand-new
	// uid (exists=false) has no stored rows to compare against, so it
	// always takes the normal extract+embed path.
	isVersionStale := exists && version < builder.Version()

	if embed.HasPendingDeleteLabel(iter.Value()) {
		statusLabel = "skipped_pending_delete"
		return nil
	}

	if b.shouldSkipForZeroViews(ctx, builder, namespace, name) {
		statusLabel = "skipped_zero_views"
		return nil
	}

	key := &resourcepb.ResourceKey{
		Group:     group,
		Resource:  res,
		Namespace: namespace,
		Name:      name,
	}

	// Unlike Extract, a folder title lookup hits storage and can fail
	// transiently — treat it as a retryable item error rather than a
	// permanent one.
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
		// Folder is deliberately not compared here (unlike the reconciler,
		// which force-differs on a folder move): under v2 a folder move
		// changes content anyway (the breadcrumb gets the folder-title
		// prefix), so content equality already subsumes that case for this
		// extractor version.
		if identicalContent(stored, items) {
			if err := b.vectorBackend.UpdateContentVersion(ctx, namespace, job.Model, res, name, builder.Version()); err != nil {
				return fmt.Errorf("update content version %s/%s: %w", namespace, name, err)
			}
			statusLabel = "skipped_identical_content"
			return nil
		}
		// Not identical: fall through to the full re-embed below. Per-panel
		// diffing is deliberately not done — under v2 the folder-prefix
		// touches every panel, so diffing would leave some rows re-embedded
		// at the new version and others stranded at the old one, and the
		// stranded rows would be rescanned forever. Re-embedding every item
		// keeps a uid's rows version-uniform.
	}

	vectors, err := b.batchEmbedder.Embed(ctx, namespace, res, rv, builder.Version(), items)
	if err != nil {
		return fmt.Errorf("embed %s/%s: %w", namespace, name, err)
	}

	// desired is the full subresource set the extractor produced this time;
	// UpsertReplaceSubresources deletes any stored row not in this list, so a
	// re-embed after e.g. a dropped panel doesn't leave a stale row behind.
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

// identicalContent reports whether extracted matches stored exactly: same
// subresource key set, and equal content per key.
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

// resolveFolderTitle resolves the display title for the folder referenced by
// value's k8s annotation, caching per job run (see folderTitleCache).
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

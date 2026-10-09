package backfill

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

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

const defaultBackfillPageSize = 50

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
	// BuilderProvider takes precedence over Builders and is read only at runtime,
	// after the initial manifests have loaded.
	BuilderProvider embed.BuilderProvider
	// DashboardStats is optional; nil disables the views filter.
	DashboardStats builders.DashboardStats
	// Metrics are always recorded. Nil means unregistered metrics, for
	// callers without a registry.
	Metrics *resource.VectorMetrics
	// Interval is how often Run re-scans for incomplete jobs (jobs are
	// created lazily by the reconciler's write path). Defaults to 1m.
	Interval time.Duration
	// PageSize is the number of non-dashboard resources per page. Defaults to 50.
	PageSize int
}

type VectorBackfiller struct {
	storage         resource.StorageBackend
	vectorBackend   vector.VectorBackend
	batchEmbedder   *embedder.BatchEmbedder
	builders        embed.BuilderSnapshot
	builderProvider embed.BuilderProvider
	dashboardStats  builders.DashboardStats
	log             log.Logger
	metrics         *resource.VectorMetrics
	interval        time.Duration
	pageSize        int

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
	if opts.BuilderProvider == nil && len(opts.Builders) == 0 {
		return nil, fmt.Errorf("backfill: at least one Builder is required")
	}

	seen := make(map[string]struct{}, len(opts.Builders))
	for _, builder := range opts.Builders {
		key := builder.Group() + "/" + builder.Resource()
		if _, duplicate := seen[key]; duplicate {
			return nil, fmt.Errorf("backfill: duplicate builder for resource %q", key)
		}
		seen[key] = struct{}{}
	}

	interval := opts.Interval
	if interval <= 0 {
		interval = defaultBackfillInterval
	}
	pageSize := opts.PageSize
	if pageSize <= 0 {
		pageSize = defaultBackfillPageSize
	}
	// Recording sites should not have to check for nil.
	metrics := opts.Metrics
	if metrics == nil {
		metrics = resource.ProvideVectorMetrics(nil)
	}

	return &VectorBackfiller{
		storage:             opts.Storage,
		vectorBackend:       opts.VectorBackend,
		batchEmbedder:       opts.BatchEmbedder,
		builders:            embed.NewBuilderSnapshot(opts.Builders),
		builderProvider:     opts.BuilderProvider,
		dashboardStats:      opts.DashboardStats,
		log:                 log.New("backfill"),
		metrics:             metrics,
		interval:            interval,
		pageSize:            pageSize,
		folderTitleResolver: foldertitle.NewResolver(opts.Storage),
	}, nil
}

// Run acquires a Postgres advisory lock so only one process backfills, then
// drains incomplete jobs immediately and at the configured interval. The periodic
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

	// Reuse one builder snapshot for every job in this run so manifest reloads
	// cannot change content versions midway through a job.
	builders, err := b.resolveBuilders(ctx)
	if err != nil {
		log.Error("backfill: resolve collections", "err", err)
		return
	}
	if len(builders) == 0 {
		return
	}
	b.reopenStaleJobs(ctx, log, builders)

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
		if job.Resource != "" {
			index := slices.IndexFunc(builders, func(builder collectionBuilder) bool {
				return builder.partitionKey == job.Resource
			})
			if index < 0 {
				log.Info("backfill: skipping job for unregistered resource",
					"job_id", job.ID, "job_resource", job.Resource)
				continue
			}
			// The reconciler can create a job from a newer manifest revision after
			// this backfill run captures its builders. Leave that job for the next run.
			if job.ContentVersion > builders[index].Version() {
				continue
			}
		}
		if err := b.runBackfillJob(ctx, job, builders); err != nil {
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

// reopenStaleJobs runs before listing incomplete jobs so reopened work is
// processed in the same backfill run. A failure for one builder does not block the others.
func (b *VectorBackfiller) reopenStaleJobs(ctx context.Context, log log.Logger, builders []collectionBuilder) {
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
	for _, builder := range builders {
		reopened, err := b.vectorBackend.ReopenStaleBackfillJobs(ctx, b.batchEmbedder.Model(), builder.partitionKey, builder.Version(), stoppingRV)
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

// runBackfillJob iterates the builders selected for the job. An empty
// job.Resource means all builders. Builders are processed in partition-key order,
// each with its own paginated cross-namespace scan. job.LastSeenKey stores the
// partition key and continuation token so the job can resume from the correct
// builder and page.
func (b *VectorBackfiller) runBackfillJob(ctx context.Context, job vector.BackfillJob, builders []collectionBuilder) error {
	// Fresh title cache per job run; titles aren't carried across runs.
	b.folderTitleCache = make(map[string]string)

	// Decode cursor to see if we need to resume
	cursor, err := decodeCursor(job.LastSeenKey)
	if err != nil {
		b.log.Warn("backfill: cursor decode failed; starting from scratch",
			"job_id", job.ID, "err", err)
		cursor = jobCursor{}
	}
	if cursor.Resource != "" && !hasBuilderForPartition(builders, cursor.Resource) {
		b.log.Warn("backfill: cursor refers to unknown resource; starting from scratch",
			"job_id", job.ID, "cursor_resource", cursor.Resource)
		cursor = jobCursor{}
	}

	for _, builder := range builders {
		// Job-level resource filter: empty means "all Builders," non-empty
		// targets exactly that Builder.
		if job.Resource != "" && builder.partitionKey != job.Resource {
			continue
		}
		// Cursor-level resume: skip Builders sorted before the cursor's
		// Resource since they completed in the prior run.
		if cursor.Resource != "" && builder.partitionKey != cursor.Resource {
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

type collectionBuilder struct {
	embed.Builder
	partitionKey string
}

// resolveBuilders returns builders for existing collections, paired with their
// catalog partition keys and sorted by those keys.
func (b *VectorBackfiller) resolveBuilders(ctx context.Context) ([]collectionBuilder, error) {
	snapshot := b.builders
	if b.builderProvider != nil {
		snapshot = b.builderProvider.Snapshot()
	}
	selected := snapshot.Builders()
	builders := make([]collectionBuilder, 0, len(selected))
	for _, builder := range selected {
		collection, found, err := b.vectorBackend.ResolveCollection(ctx, builder.Group(), builder.Resource())
		if err != nil {
			return nil, fmt.Errorf("%s/%s: %w", builder.Group(), builder.Resource(), err)
		}
		if !found {
			// The reconciler provisions the collection when it processes its first write.
			continue
		}
		if collection.IsExternal {
			return nil, fmt.Errorf("%s/%s is an external collection", builder.Group(), builder.Resource())
		}
		builders = append(builders, collectionBuilder{Builder: builder, partitionKey: collection.PartitionKey})
	}
	slices.SortFunc(builders, func(a, b collectionBuilder) int {
		return strings.Compare(a.partitionKey, b.partitionKey)
	})
	return builders, nil
}

func hasBuilderForPartition(builders []collectionBuilder, partitionKey string) bool {
	return slices.ContainsFunc(builders, func(builder collectionBuilder) bool {
		return builder.partitionKey == partitionKey
	})
}

// runBackfillPage processes one page of items. Returns the
// next-page token; empty when the iterator exhausted (no more pages).
func (b *VectorBackfiller) runBackfillPage(ctx context.Context, job vector.BackfillJob, builder collectionBuilder, pageToken string) (string, error) {
	pageSize := b.pageSize
	if builder.Group() == dashboardGroup && builder.Resource() == dashboardResource {
		// A dashboard already produces a batch of panel texts.
		pageSize = 1
	}
	req := &resourcepb.ListRequest{
		Limit:           int64(pageSize),
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

	page := make([]*preparedBackfillItem, 0, pageSize)
	completed := 0
	defer func() {
		for _, item := range page[completed:] {
			// A failure elsewhere leaves pending writes aborted, not failed.
			if item.err == nil && item.action != backfillSkip {
				item.status = "aborted"
			}
			b.observeBackfillItem(item)
		}
	}()
	var pendingTok, nextToken string
	_, err := b.storage.ListIterator(ctx, req, func(iter resource.ListIterator) error {
		for iter.Next() {
			if iterErr := iter.Error(); iterErr != nil {
				return iterErr
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			// ContinueToken peeks at the next row. Confirm that row exists
			// before saving a token that could be used to resume the job.
			if pendingTok != "" {
				page[len(page)-1].nextToken = pendingTok
				pendingTok = ""
			}
			if len(page) == pageSize {
				nextToken = page[len(page)-1].nextToken
				return nil
			}
			item, err := b.prepareBackfillItem(ctx, job, builder, iter)
			page = append(page, item)
			if err != nil {
				item.err = err
				return err
			}
			pendingTok = iter.ContinueToken()
		}
		return iter.Error()
	})
	if err != nil {
		return "", err
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}

	inputs := make([]embedder.ResourceInput, len(page))
	for i, item := range page {
		if item.action == backfillEmbed {
			inputs[i] = embedder.ResourceInput{Namespace: item.key.Namespace, ResourceVersion: item.rv, Items: item.items}
		}
	}
	vectors, err := b.batchEmbedder.EmbedResources(ctx, builder.partitionKey, builder.Version(), inputs)
	if err != nil {
		for _, item := range page {
			if item.action == backfillEmbed {
				item.err = err
			}
		}
		return "", err
	}
	for i, item := range page {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		if err := b.writeBackfillItem(job, builder, item, vectors[i]); err != nil {
			item.err = err
			return "", err
		}
		b.observeBackfillItem(item)
		completed++
		// Advance only over completed objects. A later write failure must
		// leave the failed object and the rest of the page reachable.
		if item.nextToken != "" {
			if err := b.vectorBackend.UpdateBackfillJobCheckpoint(ctx, job.ID, encodeCursor(builder.partitionKey, item.nextToken), ""); err != nil {
				return "", fmt.Errorf("checkpoint: %w", err)
			}
		}
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
	if pgxErr, ok := errors.AsType[*pgconn.PgError](err); ok {
		return strings.HasPrefix(pgxErr.Code, "22")
	}
	if pqErr, ok := errors.AsType[*pq.Error](err); ok {
		return pqErr.Code.Class() == "22"
	}
	return false
}

// skipPermanentItem logs an unfixable item being skipped so it can't wedge the job.
func (b *VectorBackfiller) skipPermanentItem(stage, namespace, group, res, name string, err error) {
	b.log.Warn("backfill: permanent error; skipping item",
		"stage", stage, "namespace", namespace, "group", group, "resource", res, "name", name, "err", err)
}

type backfillAction int

const (
	backfillSkip backfillAction = iota
	backfillEmbed
	backfillUpdateFolder
	backfillUpdateVersion
	backfillDelete
)

type preparedBackfillItem struct {
	key          *resourcepb.ResourceKey
	rv           int64
	items        []embed.Item
	folder       string
	updateFolder bool
	action       backfillAction
	nextToken    string
	status       string
	err          error
	ctx          context.Context
	span         trace.Span
	start        time.Time
}

// Preparation only reads storage. Writes wait until the page's provider calls
// succeed, then commit in scan order so a failed object remains retryable.
func (b *VectorBackfiller) prepareBackfillItem(ctx context.Context, job vector.BackfillJob, builder collectionBuilder, iter resource.ListIterator) (*preparedBackfillItem, error) {
	ctx, span := tracer.Start(ctx, "unified.backfill.processBackfillItem")
	namespace := iter.Namespace()
	name := iter.Name()
	group := builder.Group()
	res := builder.Resource()
	item := &preparedBackfillItem{
		key:   &resourcepb.ResourceKey{Group: group, Resource: res, Namespace: namespace, Name: name},
		rv:    iter.ResourceVersion(),
		ctx:   ctx,
		span:  span,
		start: time.Now(),
	}
	span.SetAttributes(
		attribute.String("group", group),
		attribute.String("resource", res),
		attribute.String("namespace", namespace),
		attribute.String("uid", name),
	)

	// Compare in snowflake space so the bound holds whether the item RV and
	// the stored stopping_rv came from the kv (snowflake) or legacy sql
	// (microsecond) backend — e.g. after a SQL<->KV backend swap.
	if resource.ToSnowflakeRV(item.rv) > resource.ToSnowflakeRV(job.StoppingRV) {
		item.status = "skipped_rv_past_stopping"
		return item, nil
	}

	// Same-or-newer stored version: nothing to do.
	version, exists, err := b.vectorBackend.ContentVersion(ctx, namespace, job.Model, builder.partitionKey, name)
	if err != nil {
		return item, fmt.Errorf("content version check: %w", err)
	}
	if exists && version >= builder.Version() {
		item.status = "skipped_already_embedded"
		return item, nil
	}
	// Only version-stale uids get the identical-content check; new uids have nothing to compare.
	isVersionStale := exists && version < builder.Version()

	if embed.HasPendingDeleteLabel(iter.Value()) {
		item.status = "skipped_pending_delete"
		return item, nil
	}

	// Zero views only gates NEW embeds; already-embedded dashboards stay embedded and current.
	if !exists && b.shouldSkipForZeroViews(ctx, builder, namespace, name) {
		item.status = "skipped_zero_views"
		return item, nil
	}

	// Storage errors fail the job so the next backfill run retries this item, unlike permanent Extract errors.
	folderTitle, err := b.resolveFolderTitle(ctx, namespace, iter.Value())
	if err != nil {
		return item, fmt.Errorf("resolve folder title %s/%s: %w", namespace, name, err)
	}

	items, err := builder.Extract(ctx, item.key, iter.Value(), folderTitle)
	if errors.Is(err, embed.ErrSkip) {
		if exists {
			item.action = backfillUpdateFolder
			item.folder = embed.FolderUIDFromValue(iter.Value())
		}
		item.status = "skipped_extract"
		return item, nil
	}
	if err != nil {
		// Extract is deterministic over stored bytes; failures are permanent.
		b.skipPermanentItem("extract", namespace, group, res, name, err)
		item.status = "skipped_permanent_error"
		return item, nil
	}
	if resCap := builder.MaxItemsPerResource(); resCap > 0 && len(items) > resCap {
		items = items[:resCap]
	}
	item.items = items
	if len(items) == 0 {
		// A version-stale uid whose new extractor output is empty must shed its old rows, like the reconciler's empty-extract path.
		if isVersionStale {
			item.action = backfillDelete
			item.status = "deleted_empty_extract"
			return item, nil
		}
		item.status = "skipped_empty_extract"
		// this shouldn't happen that often. If it does, use this to look up the dashboard json and understand why nothing was extracted.
		b.log.Info("skipping empty extract", "namespace", namespace, "group", group, "resource", res, "name", name)
		return item, nil
	}

	if isVersionStale {
		stored, storedFolder, err := b.vectorBackend.GetSubresourceContent(ctx, namespace, job.Model, builder.partitionKey, name)
		if err != nil {
			return item, fmt.Errorf("get stored content %s/%s: %w", namespace, name, err)
		}
		if identicalContent(stored, items) {
			item.action = backfillUpdateVersion
			item.folder = items[0].Folder
			item.updateFolder = storedFolder != item.folder
			item.status = "skipped_identical_content"
			return item, nil
		}
		// Not identical: re-embed everything. Per-panel diffing would strand unchanged rows at the old version and rescan them forever.
	}

	item.action = backfillEmbed
	item.status = "embedded"
	return item, nil
}

func (b *VectorBackfiller) observeBackfillItem(item *preparedBackfillItem) {
	defer item.span.End()
	if item.err != nil {
		item.status = "error"
		item.span.RecordError(item.err)
		item.span.SetStatus(codes.Error, item.err.Error())
	}
	metricutil.ObserveWithExemplar(item.ctx,
		b.metrics.BackfillItemDuration.WithLabelValues(item.key.Group, item.key.Resource, item.status),
		time.Since(item.start).Seconds(),
	)
}

func (b *VectorBackfiller) writeBackfillItem(job vector.BackfillJob, builder collectionBuilder, item *preparedBackfillItem, vectors []vector.Vector) error {
	ctx := item.ctx
	namespace, name := item.key.Namespace, item.key.Name

	// The reconciler may have handled a newer revision while this page was
	// being embedded. If the resource has been modified since, then skip it
	// for backfilling.
	if item.action != backfillSkip {
		if outcome, err := b.checkLiveRV(ctx, item.key, item.rv); err != nil {
			return err
		} else if outcome.skip {
			item.status = outcome.status
			return nil
		}
	}

	switch item.action {
	case backfillSkip:
		return nil
	case backfillUpdateFolder:
		if err := b.vectorBackend.UpdateFolder(ctx, namespace, job.Model, builder.partitionKey, name, item.folder); err != nil {
			return fmt.Errorf("update skipped resource folder %s/%s: %w", namespace, name, err)
		}
		return nil
	case backfillUpdateVersion:
		if item.updateFolder {
			// Save the folder before advancing the version so a failed move stays retryable.
			if err := b.vectorBackend.UpdateFolder(ctx, namespace, job.Model, builder.partitionKey, name, item.folder); err != nil {
				return fmt.Errorf("update folder %s/%s: %w", namespace, name, err)
			}
		}
		if err := b.vectorBackend.UpdateContentVersion(ctx, namespace, job.Model, builder.partitionKey, name, builder.Version()); err != nil {
			return fmt.Errorf("update content version %s/%s: %w", namespace, name, err)
		}
		return nil
	case backfillDelete:
		if _, _, err := b.vectorBackend.DeleteRows(ctx, namespace, job.Model, builder.partitionKey, vector.DeleteSelector{UIDs: []string{name}}); err != nil {
			return fmt.Errorf("delete empty extract %s/%s: %w", namespace, name, err)
		}
		return nil
	case backfillEmbed:
		// Replace-with-desired sheds stored rows for panels the extractor no longer produces.
		desired := make([]string, 0, len(item.items))
		for _, it := range item.items {
			desired = append(desired, it.Subresource)
		}

		if err := b.vectorBackend.UpsertReplaceSubresources(ctx, namespace, job.Model, builder.partitionKey, name, vectors, nil, desired); err != nil {
			if isPermanentItemError(err) {
				b.skipPermanentItem("upsert", namespace, item.key.Group, item.key.Resource, name, err)
				item.status = "skipped_permanent_error"
				return nil
			}
			return fmt.Errorf("upsert %s/%s: %w", namespace, name, err)
		}
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

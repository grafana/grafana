package backfill

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

const backfillPageSize = 100

type Options struct {
	Storage       resource.StorageBackend
	VectorBackend vector.VectorBackend
	BatchEmbedder *embedder.BatchEmbedder
	Builders      []embed.Builder
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
	log            log.Logger
}

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

	return &VectorBackfiller{
		storage:        opts.Storage,
		vectorBackend:  opts.VectorBackend,
		batchEmbedder:  opts.BatchEmbedder,
		builders:       builders,
		sortedBuilders: sorted,
		log:            log.New("backfill"),
	}, nil
}

// Run first acquires a Postgres advisory lock so that only one process runs the
// backfiller at a time.
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
	return ctx.Err()
}

// runBackfill processes every incomplete vector_backfill_jobs row serially.
func (b *VectorBackfiller) runBackfill(ctx context.Context) {
	log := b.log.FromContext(ctx)

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

// runBackfillJob iterates registered Builders for the job. When job.Resource is empty is means all builders.
// Builders are processed in deterministic resource-name order; each one gets its own paginated cross-namespace scan.
// last_seen_key contains the continue token and the resource name so we know which builder to resume from.
func (b *VectorBackfiller) runBackfillJob(ctx context.Context, job vector.BackfillJob) error {
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

// processBackfillItem runs the per-resource pipeline: skip if RV>stopping_rv
// or already embedded, else extract → embed → upsert.
func (b *VectorBackfiller) processBackfillItem(ctx context.Context, job vector.BackfillJob, builder embed.Builder, iter resource.ListIterator) error {
	rv := iter.ResourceVersion()
	if rv > job.StoppingRV {
		return nil
	}

	namespace := iter.Namespace()
	name := iter.Name()

	// if the embedding exists, then we don't need to backfill it
	exists, err := b.vectorBackend.Exists(ctx, namespace, job.Model, builder.Resource(), name)
	if err != nil {
		return fmt.Errorf("exists check: %w", err)
	}
	if exists {
		return nil
	}

	key := &resourcepb.ResourceKey{
		Group:     builder.Group(),
		Resource:  builder.Resource(),
		Namespace: namespace,
		Name:      name,
	}

	items, err := builder.Extract(ctx, key, iter.Value(), "")
	if err != nil {
		return fmt.Errorf("extract %s/%s: %w", namespace, name, err)
	}
	if resCap := builder.MaxItemsPerResource(); resCap > 0 && len(items) > resCap {
		items = items[:resCap]
	}
	if len(items) == 0 {
		return nil
	}

	vectors, err := b.batchEmbedder.Embed(ctx, namespace, builder.Resource(), rv, items)
	if err != nil {
		return fmt.Errorf("embed %s/%s: %w", namespace, name, err)
	}

	if err := b.vectorBackend.Upsert(ctx, vectors); err != nil {
		return fmt.Errorf("upsert %s/%s: %w", namespace, name, err)
	}
	return nil
}

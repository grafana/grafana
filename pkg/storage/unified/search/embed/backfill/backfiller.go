package backfill

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// backfillPageSize is the number of items processed per ListIterator call.
// Smaller pages keep memory steady and surface checkpointing more often;
// larger pages trade memory for fewer storage round-trips.
const backfillPageSize = 100

// Options bundles the backfiller's dependencies. All fields except
// Builders and Log are required.
type Options struct {
	Storage       resource.StorageBackend
	VectorBackend vector.VectorBackend
	Embedder      *embedder.Embedder
	BatchEmbedder *embedder.BatchEmbedder
	Builders      []Builder
	Log           log.Logger
}

// Backfiller drains incomplete vector_backfill_jobs rows on startup,
// embedding any resources whose vectors are missing. Single goroutine —
// see Run.
type Backfiller struct {
	storage       resource.StorageBackend
	vectorBackend vector.VectorBackend
	embedder      *embedder.Embedder
	batchEmbedder *embedder.BatchEmbedder

	// builders is keyed by Resource(). We don't allow two Builders with
	// the same resource name (even across different groups) so the cursor
	// — which encodes only the resource — can disambiguate on resume.
	builders map[string]Builder

	log log.Logger
}

// New validates options and constructs a Backfiller. Callers wire it into
// the modular path's invisible vector module (or the in-process newClient)
// and call Run from a background goroutine.
func New(opts Options) (*Backfiller, error) {
	if opts.Storage == nil {
		return nil, fmt.Errorf("backfill: Storage is required")
	}
	if opts.VectorBackend == nil {
		return nil, fmt.Errorf("backfill: VectorBackend is required")
	}
	if opts.Embedder == nil {
		return nil, fmt.Errorf("backfill: Embedder is required")
	}
	if opts.BatchEmbedder == nil {
		return nil, fmt.Errorf("backfill: BatchEmbedder is required")
	}
	if len(opts.Builders) == 0 {
		return nil, fmt.Errorf("backfill: at least one Builder is required")
	}
	if opts.Log == nil {
		opts.Log = log.New("backfill")
	}

	builders := make(map[string]Builder, len(opts.Builders))
	for _, b := range opts.Builders {
		r := b.Resource()
		if _, dup := builders[r]; dup {
			return nil, fmt.Errorf("backfill: duplicate builder for resource %q", r)
		}
		builders[r] = b
	}

	return &Backfiller{
		storage:       opts.Storage,
		vectorBackend: opts.VectorBackend,
		embedder:      opts.Embedder,
		batchEmbedder: opts.BatchEmbedder,
		builders:      builders,
		log:           opts.Log,
	}, nil
}

// Run executes the backfill loop and returns when it's done (all incomplete
// jobs processed or ctx cancelled). It does not block waiting for new jobs —
// new model rollouts insert rows into vector_backfill_jobs and get picked
// up on the next process restart.
//
// Run first acquires a Postgres advisory lock so that only one pod runs the
// backfiller at a time. If another pod already holds the lock, Run returns
// nil immediately and that pod's restart is the next opportunity to take
// over.
func (b *Backfiller) Run(ctx context.Context) error {
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
// Process restarts pick up new jobs (e.g. after an operator inserts a new model
// row) on next boot. Errors mark the job's last_error column and are retried
// on the next startup.
func (b *Backfiller) runBackfill(ctx context.Context) {
	log := b.log.FromContext(ctx)

	jobs, err := b.vectorBackend.ListIncompleteBackfillJobs(ctx)
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
		if err := b.runBackfillJob(ctx, job); err != nil {
			log.Error("backfill: job failed",
				"job_id", job.ID, "model", job.Model, "err", err)
			// Stamp the error so an operator can see it. Re-run on next pod start.
			_ = b.vectorBackend.UpdateBackfillJobCheckpoint(ctx, job.ID, job.LastSeenKey, err.Error())
			continue
		}
		if err := b.vectorBackend.CompleteBackfillJob(ctx, job.ID); err != nil {
			log.Error("backfill: complete job", "job_id", job.ID, "err", err)
		} else {
			log.Info("backfill: job complete", "job_id", job.ID, "model", job.Model)
		}
	}
}

// runBackfillJob iterates every registered Builder under the job's model.
// Builders are processed in deterministic resource-name order; each one
// gets its own paginated cross-namespace scan.
//
// Resume: last_seen_key is JSON-encoded as (resource, token) — see
// cursor.go. The encoded resource pins the token to the Builder it was
// captured against. On a cold start we skip Builders sorted before the
// matching one (their iterations already completed in the previous run),
// resume the matching one at its saved token, and run any later
// Builders from scratch. If the cursor's resource doesn't match any
// registered Builder (e.g. a Builder was removed), the cursor is logged
// and ignored, and every Builder runs from scratch.
func (b *Backfiller) runBackfillJob(ctx context.Context, job vector.BackfillJob) error {
	if job.Model != b.embedder.Model {
		// Job was queued for a model the backfiller isn't running. Operator
		// must redeploy with the matching model or delete the job row.
		return fmt.Errorf("job model %q != configured model %q", job.Model, b.embedder.Model)
	}

	// If the job targets a specific resource, that resource must be
	// registered. An unknown target means there's nothing for this pod to
	// do — log and let the job complete cleanly rather than spinning on
	// every restart.
	if job.Resource != "" && !b.hasBuilderForResource(job.Resource) {
		b.log.Warn("backfill: job targets unregistered resource; marking complete",
			"job_id", job.ID, "job_resource", job.Resource)
		return nil
	}

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

	for _, builder := range b.sortedBuilders() {
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

// hasBuilderForResource reports whether the registry contains a Builder
// for the given resource name.
func (b *Backfiller) hasBuilderForResource(resource string) bool {
	_, ok := b.builders[resource]
	return ok
}

// sortedBuilders returns the registered Builders in deterministic order
// so iteration matches across pod restarts.
func (b *Backfiller) sortedBuilders() []Builder {
	keys := make([]string, 0, len(b.builders))
	for k := range b.builders {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([]Builder, 0, len(b.builders))
	for _, k := range keys {
		out = append(out, b.builders[k])
	}
	return out
}

// runBackfillPage processes up to backfillPageSize items. Returns the
// next-page token; empty when the iterator exhausted (no more pages).
func (b *Backfiller) runBackfillPage(ctx context.Context, job vector.BackfillJob, builder Builder, pageToken string) (string, error) {
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
		processed int
		nextToken string
	)
	_, err := b.storage.ListIterator(ctx, req, func(iter resource.ListIterator) error {
		for iter.Next() {
			if iterErr := iter.Error(); iterErr != nil {
				return iterErr
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if processed == backfillPageSize {
				return nil
			}
			if err := b.processBackfillItem(ctx, job, builder, iter); err != nil {
				return err
			}
			processed++
			// Per-item checkpoint. Encode the cursor with the current
			// Builder's resource so resume picks the correct Builder.
			tok := iter.ContinueToken()
			encoded := encodeCursor(builder.Resource(), tok)
			if cerr := b.vectorBackend.UpdateBackfillJobCheckpoint(ctx, job.ID, encoded, ""); cerr != nil {
				return fmt.Errorf("checkpoint: %w", cerr)
			}
			nextToken = tok
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if processed < backfillPageSize {
		return "", nil
	}
	return nextToken, nil
}

// processBackfillItem runs the per-resource pipeline: skip if RV>stopping_rv
// or already embedded, else extract → embed → upsert.
func (b *Backfiller) processBackfillItem(ctx context.Context, job vector.BackfillJob, builder Builder, iter resource.ListIterator) error {
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

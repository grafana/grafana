package search

import (
	"context"
	"iter"

	"go.opentelemetry.io/otel/attribute"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Matches the read path's batch size, so both scans read equally far ahead of what
// the caller consumes.
const trashBatchSize = authlib.MaxBatchCheckItems

// trashAuthorized filters candidates by the trash rule instead of the read check.
// Shaped like authz.FilterAuthorized so it substitutes at the existing per-item
// authorization hook rather than forking the read path.
//
// Batched because deciding folders one at a time cost a round trip each, which for
// a listing spanning many folders added up to seconds.
func trashAuthorized(
	ctx context.Context,
	candidates iter.Seq[docInfo],
	authorizer *resource.TrashAuthorizer,
) iter.Seq2[docInfo, error] {
	return func(yield func(docInfo, error) bool) {
		ctx, span := tracer.Start(ctx, "search.trashAuthorized")
		defer span.End()

		var considered, allowed int64
		defer func() {
			span.SetAttributes(
				attribute.Int64("search.candidates", considered),
				attribute.Int64("search.authorized", allowed),
			)
		}()

		// Reports whether the scan should continue.
		flush := func(batch []docInfo) bool {
			if len(batch) == 0 {
				return true
			}
			if err := ctx.Err(); err != nil {
				yield(docInfo{}, err)
				return false
			}

			items := make([]resource.TrashItem, 0, len(batch))
			for _, info := range batch {
				items = append(items, resource.TrashItem{Folder: info.folder, DeletedBy: info.deletedBy})
			}
			authorizer.Prepare(ctx, items)

			for _, info := range batch {
				// Per item, not per batch: a folder Prepare left undecided still costs a
				// check, and on a dead context that reads as a denial rather than an error.
				if err := ctx.Err(); err != nil {
					yield(docInfo{}, err)
					return false
				}
				if !authorizer.Allowed(ctx, info.folder, info.deletedBy) {
					continue
				}
				allowed++
				if !yield(info, nil) {
					return false
				}
			}
			return true
		}

		batch := make([]docInfo, 0, trashBatchSize)
		for info := range candidates {
			// Counted where the candidate is pulled, so a batch cut short by the caller
			// still reports what the scan read.
			considered++
			batch = append(batch, info)
			if len(batch) < trashBatchSize {
				continue
			}
			if !flush(batch) {
				return
			}
			batch = batch[:0]
		}
		flush(batch)
	}
}

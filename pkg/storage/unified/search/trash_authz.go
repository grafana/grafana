package search

import (
	"context"
	"iter"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// trashAuthorized filters candidates by the trash rule instead of the read check.
// Shaped like authz.FilterAuthorized so it substitutes at the existing per-item
// authorization hook rather than forking the read path.
//
// Unbatched on purpose: FilterAuthorized batches because the read check costs one
// call per item, whereas the trash rule costs one per distinct folder and none for
// objects the caller deleted.
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

		for info := range candidates {
			considered++
			if err := ctx.Err(); err != nil {
				yield(docInfo{}, err)
				return
			}
			if !authorizer.Allowed(ctx, info.folder, info.deletedBy) {
				continue
			}
			allowed++
			if !yield(info, nil) {
				return
			}
		}
	}
}

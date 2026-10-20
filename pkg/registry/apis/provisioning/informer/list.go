package informer

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// pageLimit caps each LIST page. Unified storage caps a page at 500 items / 2 MB
// server-side regardless, so requesting 500 matches the server and keeps the
// continue-token chain predictable.
const pageLimit = 500

// pageFunc reads one page of a LIST for the given options; opts.Continue selects
// the page. It is the typed client's List call, adapted to runtime.Object.
type pageFunc func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error)

// identityList builds an informer re-list that hands the Store identities only:
// namespace, name and resource version, which is all its diff keys off and all a
// reconcile needs to re-fetch the object. With a keys lister it asks storage for
// identities and no body is read; without one, or against a server that does not
// serve the projection, it lists full objects and projects them, so the Store
// holds the same shape either way.
func identityList(keys keysapi.Lister, page pageFunc, recorder RelistRecorder) func(context.Context) ([]runtime.Object, int64, error) {
	return func(ctx context.Context) ([]runtime.Object, int64, error) {
		if keys != nil {
			objs, listRV, err := listKeys(ctx, keys)
			if err == nil {
				recorder.Projection(true)
				return objs, listRV, nil
			}
			if !errors.Is(err, keysapi.ErrUnsupported) {
				return nil, 0, err
			}
			// The server did not serve keys: over storage it predates keys_only,
			// over HTTP the route is absent. Either way the full list is still
			// correct, and failing the tick would stop reconciling altogether.
			logging.FromContext(ctx).Warn("server did not serve a keys-only list, re-listing full objects", "error", err)
		}
		objs, listRV, err := listAllPages(ctx, page)
		if err != nil {
			return nil, 0, err
		}
		recorder.Projection(false)
		return projectObjects(objs), listRV, nil
	}
}

// listKeys drains a keys-only list. The Store diffs the whole set, so a partial
// stream is an error, never a shorter snapshot.
func listKeys(ctx context.Context, keys keysapi.Lister) ([]runtime.Object, int64, error) {
	listRV, seq := keys.ListKeys(ctx)
	var objs []runtime.Object
	for k, err := range seq {
		if err != nil {
			return nil, 0, err
		}
		objs = append(objs, identity(k.Namespace, k.Name, k.ResourceVersion))
	}
	return objs, listRV, nil
}

// identity is what the informer snapshots hold in place of an object.
func identity(namespace, name, resourceVersion string) *metav1.PartialObjectMetadata {
	return &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
		Namespace:       namespace,
		Name:            name,
		ResourceVersion: resourceVersion,
	}}
}

// projectObjects replaces each listed object with its identity, in place.
func projectObjects(objs []runtime.Object) []runtime.Object {
	for i, obj := range objs {
		if acc, err := meta.Accessor(obj); err == nil {
			objs[i] = identity(acc.GetNamespace(), acc.GetName(), acc.GetResourceVersion())
		}
	}
	return objs
}

// listAllPages reads every page of a LIST, following continue tokens: unified
// storage caps a single page at 500 items / 2 MB, and the informers' re-list
// must be complete — a truncated list would strand objects beyond the first
// page and make the informer's snapshot diff report them as deleted.
//
// It also returns the resource version the snapshot was read at, which the
// informer uses to reconcile the re-list against live write-throughs that raced
// it. A paginated LIST pins the resource version across pages via the continue
// token, so the first page's is the snapshot version.
func listAllPages(ctx context.Context, page pageFunc) ([]runtime.Object, int64, error) {
	objs, listRV, _, err := listPages(ctx, page, "", nil)
	return objs, listRV, err
}

// listPages reads pages of a LIST starting at startContinue, following continue
// tokens until the list is exhausted or keepPaging reports there is no capacity
// for more. It returns the objects read, the resource version the snapshot was
// read at, and the continue token to resume from — empty when the list was read
// to the end. keepPaging receives the objects gathered so far and is checked
// between pages, so the first page is always read; a nil keepPaging reads every
// page. Passing the objects (not just a count) is what lets the caller cap a
// single pass on its own terms — weighing only the work it can act on — because
// the objects are not dispatched until the whole list returns, so a queue-length
// signal alone cannot see the backlog the pass is building.
//
// On an expired continue token the page read fails and the error is propagated,
// rather than retried as one unpaginated LIST — which the server would cap again
// and hand back the truncated snapshot pagination exists to prevent. The caller
// resumes from page 1 on an expired resume token; see resumableLister.
func listPages(ctx context.Context, page pageFunc, startContinue string, keepPaging func(objs []runtime.Object) bool) (objs []runtime.Object, listRV int64, nextContinue string, err error) {
	opts := metav1.ListOptions{Limit: pageLimit, Continue: startContinue}
	for {
		obj, err := page(ctx, opts)
		if err != nil {
			return nil, 0, "", err
		}
		m, err := meta.ListAccessor(obj)
		if err != nil {
			return nil, 0, "", err
		}
		// The continue token pins the resource version across pages, so the first
		// page's version dates the whole snapshot.
		if listRV == 0 {
			if rv, perr := strconv.ParseInt(m.GetResourceVersion(), 10, 64); perr == nil {
				listRV = rv
			}
		}
		items, err := meta.ExtractList(obj)
		if err != nil {
			return nil, 0, "", err
		}
		objs = append(objs, items...)

		cont := m.GetContinue()
		if cont == "" {
			return objs, listRV, "", nil
		}
		if keepPaging != nil && !keepPaging(objs) {
			return objs, listRV, cont, nil
		}
		opts.Continue = cont
	}
}

// resumableLister drives capacity-gated pagination that resumes across calls: a
// call that stopped early under backpressure records its continue token, and the
// next call continues past the pages it already covered instead of re-reading
// page 1. Without this, a queue that stays saturated across resyncs would fetch
// the same first page every time and never discover jobs on later pages whose
// live events were missed. It is not safe for concurrent use; the informer calls
// it from a single goroutine (relist).
type resumableLister struct {
	cont string // continue token to resume the next call from; "" starts a fresh sweep
	// pruneNext forces the next fresh sweep to read the whole list in one snapshot
	// (ignoring capacity) so the informer can delete-diff and prune. It is set once a
	// rotation of partial passes has covered every page: those passes only ever
	// upsert (Store.Merge), so without an occasional complete sweep a replica that
	// missed a job's queue-grouped delete would retain it forever and its snapshot
	// would grow without bound under sustained churn.
	pruneNext bool
}

// sweepKind qualifies the objects a resumableLister pass returns, so the informer
// knows how to reconcile them.
type sweepKind int

const (
	// sweepPartial is a deliberately truncated view: upsert only, never delete-diff.
	sweepPartial sweepKind = iota
	// sweepComplete is a consistent full snapshot read from page 1 to the end:
	// delete-diff and dispatch adds/updates/removals.
	sweepComplete
	// sweepPrune is a consistent full snapshot read only to reconcile removals,
	// because a prior rotation of partial passes already delivered every object:
	// delete-diff but dispatch removals only, never re-dispatching survivors.
	sweepPrune
)

// list reads the next window of pages via listPages, resuming from where the
// previous partial call stopped, and reports the kind of sweep it produced.
// sweepComplete and sweepPrune arise only from a sweep that started at page 1 and
// reached the end in one continue-token chain — the only case whose objects form a
// consistent full snapshot the informer may delete-diff. An expired resume token
// (the snapshot it pointed into was compacted between resyncs) is not fatal: the
// sweep restarts from page 1 rather than failing the whole re-list.
//
// A resumed pass re-checks capacity before pulling its next window: a fresh sweep
// always reads page 1 to keep the workers fed, but continuing a prior partial pass
// while the queue is still saturated would append another page of keys per resync
// and, over time, load the entire backlog despite no worker slot opening. When
// that happens the pass is a no-op that preserves its resume point for later.
//
// A pruning sweep (scheduled once a rotation of partial passes has covered every
// page) reads the whole list regardless of capacity so removals can be computed,
// but reports sweepPrune so the informer does not re-dispatch the survivors — the
// rotation already delivered them, and re-offering the full set would re-enqueue
// the backlog in one pass.
func (r *resumableLister) list(ctx context.Context, page pageFunc, keepPaging func(objs []runtime.Object) bool) (objs []runtime.Object, listRV int64, kind sweepKind, err error) {
	startedFresh := r.cont == ""

	// Gate a resumed pass on capacity before fetching anything (keepPaging with no
	// objects is the "is there room at all" question). A fresh sweep is exempt: its
	// first page is the bootstrap that keeps the workers fed.
	if !startedFresh && keepPaging != nil && !keepPaging(nil) {
		return nil, 0, sweepPartial, nil
	}

	// A pruning sweep reads every page regardless of capacity so the result is a
	// complete snapshot the informer can delete-diff.
	pruning := startedFresh && r.pruneNext
	gate := keepPaging
	if pruning {
		gate = nil
	}

	objs, listRV, next, err := listPages(ctx, page, r.cont, gate)
	if err != nil && !startedFresh && isExpiredToken(err) {
		r.cont = ""
		startedFresh = true
		pruning = r.pruneNext
		gate = keepPaging
		if pruning {
			gate = nil
		}
		objs, listRV, next, err = listPages(ctx, page, "", gate)
	}
	if err != nil {
		return nil, 0, sweepPartial, err
	}
	r.cont = next

	switch {
	case startedFresh && next == "":
		// A full, consistent snapshot: safe to delete-diff, and it discharges any
		// pending prune. A prune sweep diffs for removals but suppresses survivor
		// re-dispatch; a plain complete sweep (the list fit within capacity)
		// dispatches everything.
		r.pruneNext = false
		if pruning {
			return objs, listRV, sweepPrune, nil
		}
		return objs, listRV, sweepComplete, nil
	case !startedFresh && next == "":
		// Finished rotating through every page via partial passes; schedule the next
		// fresh sweep to run a complete prune. This resumed sweep is itself still
		// partial — its pages came from different snapshots, so it cannot be diffed.
		r.pruneNext = true
	}
	return objs, listRV, sweepPartial, nil
}

// isExpiredToken reports whether err is the server rejecting a continue token
// whose snapshot has been compacted (410 Gone / resource expired).
func isExpiredToken(err error) bool {
	return apierrors.IsResourceExpired(err) || apierrors.IsGone(err)
}

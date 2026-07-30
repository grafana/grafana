package informer

import (
	"context"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// pageLimit caps each LIST page. Unified storage caps a page at 500 items / 2 MB
// server-side regardless, so requesting 500 matches the server and keeps the
// continue-token chain predictable.
const pageLimit = 500

// pageFunc reads one page of a LIST for the given options; opts.Continue selects
// the page. It is the typed client's List call, adapted to runtime.Object.
type pageFunc func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error)

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
// to the end. keepPaging receives the number of objects gathered so far and is
// checked between pages, so the first page is always read; a nil keepPaging reads
// every page. Passing the count (not just a boolean) is what lets the caller cap
// a single pass: the objects are not dispatched until the whole list returns, so
// a queue-length signal alone cannot see the backlog the pass is building.
//
// On an expired continue token the page read fails and the error is propagated,
// rather than retried as one unpaginated LIST — which the server would cap again
// and hand back the truncated snapshot pagination exists to prevent. The caller
// resumes from page 1 on an expired resume token; see resumableLister.
func listPages(ctx context.Context, page pageFunc, startContinue string, keepPaging func(fetched int) bool) (objs []runtime.Object, listRV int64, nextContinue string, err error) {
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
		if keepPaging != nil && !keepPaging(len(objs)) {
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
}

// list reads the next window of pages via listPages, resuming from where the
// previous partial call stopped. complete is true only for a sweep that started
// at page 1 and reached the end — the only case whose objects form a full
// snapshot the informer may delete-diff. An expired resume token (the snapshot it
// pointed into was compacted between resyncs) is not fatal: the sweep restarts
// from page 1 rather than failing the whole re-list.
func (r *resumableLister) list(ctx context.Context, page pageFunc, keepPaging func(fetched int) bool) (objs []runtime.Object, listRV int64, complete bool, err error) {
	startedFresh := r.cont == ""
	objs, listRV, next, err := listPages(ctx, page, r.cont, keepPaging)
	if err != nil && !startedFresh && isExpiredToken(err) {
		r.cont = ""
		startedFresh = true
		objs, listRV, next, err = listPages(ctx, page, "", keepPaging)
	}
	if err != nil {
		return nil, 0, false, err
	}
	r.cont = next
	return objs, listRV, startedFresh && next == "", nil
}

// isExpiredToken reports whether err is the server rejecting a continue token
// whose snapshot has been compacted (410 Gone / resource expired).
func isExpiredToken(err error) bool {
	return apierrors.IsResourceExpired(err) || apierrors.IsGone(err)
}

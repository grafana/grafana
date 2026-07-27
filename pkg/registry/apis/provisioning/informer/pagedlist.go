package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"
)

// listPageSize bounds a single LIST request issued by an informer re-list.
//
// An unbounded LIST is not bounded by how many objects exist. Unified storage
// answers it by scanning every key under the group/resource prefix - including
// every revision of every deleted resource - and returning only the live ones,
// so a resource that churns (jobs, historic jobs) costs the whole keyspace in
// one statement. Asking for pages keeps each request bounded and lets the
// storage layer stop scanning once a page is full.
//
// 500 matches client-go's own default, which is what the apiserver-backed
// informers on the non-NATS path already use.
const listPageSize = 500

// listPageFunc reads one page of a resource, honouring the limit and continue
// token in opts. It is the generated typed client's List, bound to a namespace.
type listPageFunc func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error)

// pagedList reads every object of one resource kind as a series of bounded
// pages. Callers that must hold the whole set - anything that diffs against a
// previous snapshot - use this; callers that only visit each object should use
// [eachListItem] instead, which holds a bounded number of pages rather than
// every object.
//
// It returns an error without a partial result: the caller diffs the set it
// gets against the previous one and deletes what is missing, so handing back a
// prefix of the resource would read as "everything else was deleted".
func pagedList(ctx context.Context, list listPageFunc) ([]runtime.Object, error) {
	out := make([]runtime.Object, 0, listPageSize)
	if err := eachListItem(ctx, list, func(obj runtime.Object) error {
		out = append(out, obj)
		return nil
	}); err != nil {
		return nil, err
	}
	return out, nil
}

// eachListItem calls fn for every object of one resource kind, reading the
// resource as bounded pages.
//
// The pager fetches ahead: it buffers up to PageBufferSize pages in the
// background while fn works through the current one, so memory is bounded by a
// small multiple of the page size rather than by the size of the resource. That
// read-ahead is what keeps a slow fn - one that issues an API call per object -
// from serialising a request per page against the wait for it.
//
// The objects handed to fn point into the page that delivered them, so
// retaining one retains that whole page. Either keep all of them, as
// [pagedList] does, or none of them, as a streaming caller does; keeping a few
// per page is what would waste memory.
func eachListItem(ctx context.Context, list listPageFunc, fn func(runtime.Object) error) error {
	p := pager.New(pager.ListPageFunc(list))
	p.PageSize = listPageSize
	return p.EachListItem(ctx, metav1.ListOptions{}, fn)
}

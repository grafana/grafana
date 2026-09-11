package informer

import (
	"context"
	"strconv"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"
)

// listAllPages reads every page of a LIST, following continue tokens: unified
// storage caps a single page at 500 items / 2 MB, and the informers' re-list
// must be complete — a truncated list would strand objects beyond the first
// page and make the informer's snapshot diff report them as deleted.
//
// It also returns the resource version the snapshot was read at, which the
// informer uses to reconcile the re-list against live write-throughs that raced
// it. A paginated LIST pins the resource version across pages via the continue
// token, so the first page's is the snapshot version.
func listAllPages(ctx context.Context, page func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error)) ([]runtime.Object, int64, error) {
	var listRV int64
	capture := func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		obj, err := page(ctx, opts)
		if err == nil && listRV == 0 {
			if acc, aerr := meta.ListAccessor(obj); aerr == nil {
				if rv, perr := strconv.ParseInt(acc.GetResourceVersion(), 10, 64); perr == nil {
					listRV = rv
				}
			}
		}
		return obj, err
	}
	p := pager.New(capture)
	// On an expired continue token the pager's default fallback re-issues one
	// unpaginated LIST — which the server would silently cap again, handing the
	// informer exactly the truncated snapshot this helper exists to prevent.
	// Fail instead; the informer retries the whole re-list on its next tick.
	p.FullListIfExpired = false
	var out []runtime.Object
	if err := p.EachListItem(ctx, metav1.ListOptions{Limit: 500}, func(obj runtime.Object) error {
		out = append(out, obj)
		return nil
	}); err != nil {
		return nil, 0, err
	}
	return out, listRV, nil
}

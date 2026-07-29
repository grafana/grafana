package informer

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"
)

// listAllPages reads every page of a LIST, following continue tokens: unified
// storage caps a single page at 500 items / 2 MB, and the informers' re-list
// must be complete — a truncated list would strand objects beyond the first
// page and make the informer's snapshot diff report them as deleted.
func listAllPages(ctx context.Context, page func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error)) ([]runtime.Object, error) {
	p := pager.New(page)
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
		return nil, err
	}
	return out, nil
}

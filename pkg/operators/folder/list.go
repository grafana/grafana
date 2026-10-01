package folder

import (
	"context"
	"strconv"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"
)

// listAllPages reads every page of a LIST, following continue tokens, and
// returns the resource version the snapshot was read at.
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

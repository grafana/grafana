package informer

import (
	"context"

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
// must be complete — a truncated list would strand objects beyond the first page
// and make the informer's snapshot diff report them as deleted.
func listAllPages(ctx context.Context, page pageFunc) ([]runtime.Object, error) {
	objs, _, err := listPages(ctx, page, nil)
	return objs, err
}

// listPages reads pages of a LIST, following continue tokens until the list is
// exhausted or keepPaging reports there is no capacity for more. It returns the
// objects read and whether the list is complete (every page read); complete is
// false only when keepPaging stopped the chain early. keepPaging is checked
// between pages, so the first page is always read and a set that fits in one page
// is always complete; a nil keepPaging reads every page.
//
// On an expired continue token the page read fails and the error is propagated,
// rather than retried as one unpaginated LIST — which the server would cap again
// and hand back the truncated snapshot pagination exists to prevent. The informer
// never touches its snapshot on a list error and retries the whole re-list on its
// next tick.
func listPages(ctx context.Context, page pageFunc, keepPaging func() bool) (objs []runtime.Object, complete bool, err error) {
	opts := metav1.ListOptions{Limit: pageLimit}
	for {
		obj, err := page(ctx, opts)
		if err != nil {
			return nil, false, err
		}
		items, err := meta.ExtractList(obj)
		if err != nil {
			return nil, false, err
		}
		objs = append(objs, items...)

		m, err := meta.ListAccessor(obj)
		if err != nil {
			return nil, false, err
		}
		cont := m.GetContinue()
		if cont == "" {
			return objs, true, nil
		}
		if keepPaging != nil && !keepPaging() {
			return objs, false, nil
		}
		opts.Continue = cont
	}
}

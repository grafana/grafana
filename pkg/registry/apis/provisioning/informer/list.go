package informer

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/pager"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// pageFunc reads one page of a LIST.
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

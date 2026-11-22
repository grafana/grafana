package informer

import (
	"context"
	"errors"

	appinformer "github.com/grafana/grafana/apps/provisioning/pkg/informer"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// identityList builds an informer re-list that hands the Store identities only:
// namespace, name and resource version, which is all its diff keys off and all a
// reconcile needs to re-fetch the object. With a keys lister it asks storage for
// identities and no body is read; without one, or against a server that does not
// serve the projection, it lists full objects and projects them, so the Store
// holds the same shape either way.
func identityList(keys keysapi.Lister, page appinformer.PageFunc, recorder RelistRecorder) func(context.Context) ([]runtime.Object, int64, error) {
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
		objs, listRV, err := appinformer.ListAllPages(ctx, page)
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
		objs = append(objs, appinformer.Identity(k.Namespace, k.Name, k.ResourceVersion))
	}
	return objs, listRV, nil
}

// projectObjects replaces each listed object with its identity, in place.
func projectObjects(objs []runtime.Object) []runtime.Object {
	for i, obj := range objs {
		if acc, err := meta.Accessor(obj); err == nil {
			objs[i] = appinformer.Identity(acc.GetNamespace(), acc.GetName(), acc.GetResourceVersion())
		}
	}
	return objs
}

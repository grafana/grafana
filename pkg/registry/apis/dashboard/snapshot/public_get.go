package snapshot

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func getPublicSnapshot(ctx context.Context, getter rest.Getter, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := k8srequest.NamespaceValue(ctx)
	// Public GET is already authorized; storage reads must not depend on viewer credentials.
	lookupCtx, err := publicSnapshotGetContext(ctx)
	if err != nil {
		return nil, err
	}
	obj, err := getter.Get(lookupCtx, name, options)
	if (err != nil && !apierrors.IsNotFound(err)) || namespace != "default" {
		return obj, err
	}
	lister, ok := getter.(rest.Lister)
	if !ok {
		return obj, err
	}

	// Default is a public placeholder, not the snapshot's owning namespace.
	// Resolve only the shared key, never expose a cross-namespace collection to callers.
	lookupCtx = k8srequest.WithNamespace(identity.WithServiceIdentityContext(ctx, 1), "")
	listOptions := &internalversion.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("metadata.name", name),
		Limit:         100,
	}
	var match *dashv0.Snapshot
	for {
		obj, listErr := lister.List(lookupCtx, listOptions)
		if listErr != nil {
			return nil, listErr
		}
		list, ok := obj.(*dashv0.SnapshotList)
		if !ok {
			return nil, fmt.Errorf("expected SnapshotList, got %T", obj)
		}
		for i := range list.Items {
			if list.Items[i].Name != name {
				continue
			}
			if match != nil {
				return nil, apierrors.NewConflict(dashv0.SnapshotResourceInfo.GroupResource(), name, fmt.Errorf("snapshot key is ambiguous across namespaces"))
			}
			match = list.Items[i].DeepCopy()
		}
		// Check every page: namespace-local uniqueness does not make a public key unique.
		if list.Continue == "" {
			if match == nil {
				if err != nil {
					return nil, err
				}
				return nil, apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), name)
			}
			return match, nil
		}
		if list.Continue == listOptions.Continue {
			return nil, fmt.Errorf("snapshot pagination did not advance")
		}
		listOptions.Continue = list.Continue
	}
}

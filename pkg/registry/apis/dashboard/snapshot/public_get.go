package snapshot

import (
	"context"
	"fmt"
	"time"

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

func snapshotExpired(snap *dashv0.Snapshot) bool {
	return snap.Spec.Expires != nil && *snap.Spec.Expires > 0 && time.UnixMilli(*snap.Spec.Expires).Before(time.Now())
}

func getPublicSnapshot(ctx context.Context, getter rest.Getter, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := k8srequest.NamespaceValue(ctx)
	// Public GET is already authorized; storage reads must not depend on viewer credentials.
	lookupCtx, err := publicSnapshotGetContext(ctx)
	if err != nil {
		return nil, err
	}
	if namespace != "default" {
		return getter.Get(lookupCtx, name, options)
	}
	lister, ok := getter.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("snapshot storage does not support list")
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
			// Fail closed when global key uniqueness cannot be checked.
			return nil, listErr
		}
		list, ok := obj.(*dashv0.SnapshotList)
		if !ok {
			return nil, fmt.Errorf("expected SnapshotList, got %T", obj)
		}
		for i := range list.Items {
			if list.Items[i].Name != name || snapshotExpired(&list.Items[i]) {
				continue
			}
			if match != nil {
				if match.Namespace == list.Items[i].Namespace {
					continue
				}
				return nil, apierrors.NewConflict(dashv0.SnapshotResourceInfo.GroupResource(), name, fmt.Errorf("snapshot key is ambiguous across namespaces"))
			}
			match = list.Items[i].DeepCopy()
		}
		// Check every page: namespace-local uniqueness does not make a public key unique.
		if list.Continue == "" {
			if match == nil {
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

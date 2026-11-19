package authinfo

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
)

// GuardedStore enforces on the unified store the same list, watch and deleteCollection
// restrictions that LegacyStore applies, so they hold when the legacy store is bypassed.
type GuardedStore struct {
	*registry.Store
}

func NewGuardedStore(store *registry.Store) *GuardedStore {
	return &GuardedStore{Store: store}
}

// List implements rest.Lister.
func (s *GuardedStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if err := requireListSelector(options); err != nil {
		return nil, err
	}
	return s.Store.List(ctx, options)
}

// Watch implements rest.Watcher.
func (s *GuardedStore) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	if err := requireWatchSelector(options); err != nil {
		return nil, err
	}
	return s.Store.Watch(ctx, options)
}

// DeleteCollection implements rest.CollectionDeleter.
func (s *GuardedStore) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(resourceInfo.GroupResource(), "deleteCollection")
}

func requireWatchSelector(options *internalversion.ListOptions) error {
	if options != nil && options.FieldSelector != nil {
		if _, ok := options.FieldSelector.RequiresExactMatch("metadata.name"); ok {
			return nil
		}
	}
	if requireListSelector(options) != nil {
		return apierrors.NewBadRequest("watching authinfo requires a spec.userRef.name, spec.authID or metadata.name field selector")
	}
	return nil
}

func requireListSelector(options *internalversion.ListOptions) error {
	if options != nil && options.FieldSelector != nil {
		if _, ok := options.FieldSelector.RequiresExactMatch("spec.userRef.name"); ok {
			return nil
		}
		if _, ok := options.FieldSelector.RequiresExactMatch("spec.authID"); ok {
			return nil
		}
	}
	return apierrors.NewBadRequest("listing authinfo requires a spec.userRef.name or spec.authID field selector")
}

package folders

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"
	"k8s.io/client-go/util/retry"
)

// finalizerStorage wraps a folder registry store and ensures the cascade-delete finalizer
// is persisted before delete proceeds. Legacy folders created before admission defaulting
// may not have the finalizer until the first delete.
type finalizerStorage struct {
	*registry.Store
}

func newFinalizerStorage(store *registry.Store) *finalizerStorage {
	return &finalizerStorage{Store: store}
}

func (s *finalizerStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	if options == nil || !dryrun.IsDryRun(options.DryRun) {
		if err := s.ensureCascadeFinalizer(ctx, name); err != nil {
			return nil, false, err
		}
	}
	return s.Store.Delete(ctx, name, deleteValidation, options)
}

func (s *finalizerStorage) ensureCascadeFinalizer(ctx context.Context, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := s.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return err
		}

		accessor, err := meta.Accessor(obj)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}

		if accessor.GetDeletionTimestamp() != nil && !accessor.GetDeletionTimestamp().IsZero() {
			return nil
		}
		if hasCascadeFinalizer(accessor.GetFinalizers()) {
			return nil
		}

		updated := obj.DeepCopyObject()
		updatedAccessor, err := meta.Accessor(updated)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		updatedAccessor.SetFinalizers(append(updatedAccessor.GetFinalizers(), CascadeDeleteFinalizer))

		_, _, err = s.Update(
			ctx,
			name,
			rest.DefaultUpdatedObjectInfo(updated),
			rest.ValidateAllObjectFunc,
			rest.ValidateAllObjectUpdateFunc,
			false,
			&metav1.UpdateOptions{},
		)
		return err
	})
}

func hasCascadeFinalizer(finalizers []string) bool {
	for _, f := range finalizers {
		if f == CascadeDeleteFinalizer {
			return true
		}
	}
	return false
}

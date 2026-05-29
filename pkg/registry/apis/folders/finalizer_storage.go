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
// and terminating label are persisted before delete proceeds. Legacy folders created before
// admission defaulting may not have the finalizer until the first delete, and the terminating
// label is only ever stamped here, on delete.
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
		if err := s.ensureTerminationMetadata(ctx, name); err != nil {
			return nil, false, err
		}
	}
	return s.Store.Delete(ctx, name, deleteValidation, options)
}

// ensureTerminationMetadata stamps the cascade finalizer and terminating label before delete
// proceeds. The finalizer blocks physical removal until children are gone; the label is what
// the cascade watcher selects on, so it must be present before the delete sets the deletion
// timestamp and the folder enters the watcher's filtered set.
func (s *finalizerStorage) ensureTerminationMetadata(ctx context.Context, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := s.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return err
		}

		accessor, err := meta.Accessor(obj)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}

		// Already terminating: the delete that started termination already stamped the
		// finalizer and terminating label, so there is nothing to add.
		if accessor.GetDeletionTimestamp() != nil && !accessor.GetDeletionTimestamp().IsZero() {
			return nil
		}

		updated := obj.DeepCopyObject()
		updatedAccessor, err := meta.Accessor(updated)
		if err != nil {
			return apierrors.NewInternalError(fmt.Errorf("folder object metadata: %w", err))
		}
		if !applyTerminationMetadata(updatedAccessor) {
			return nil
		}

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

// applyTerminationMetadata adds the cascade finalizer and terminating label to the object if
// either is missing. The finalizer is usually already present (admission stamps it on create),
// so in the common path this is what backfills the label. It reports whether it changed
// anything.
func applyTerminationMetadata(accessor metav1.Object) bool {
	changed := false

	if !hasCascadeFinalizer(accessor.GetFinalizers()) {
		accessor.SetFinalizers(append(accessor.GetFinalizers(), CascadeDeleteFinalizer))
		changed = true
	}

	if accessor.GetLabels()[TerminatingLabel] != TerminatingLabelValue {
		labels := accessor.GetLabels()
		if labels == nil {
			labels = map[string]string{}
		}
		labels[TerminatingLabel] = TerminatingLabelValue
		accessor.SetLabels(labels)
		changed = true
	}

	return changed
}

func hasCascadeFinalizer(finalizers []string) bool {
	for _, f := range finalizers {
		if f == CascadeDeleteFinalizer {
			return true
		}
	}
	return false
}

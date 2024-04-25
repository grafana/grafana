package rest

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode3 struct {
	DualWriter
}

// NewDualWriterMode3 returns a new DualWriter in mode 3.
// Mode 3 represents writing to LegacyStorage and Storage and reading from Storage.
func NewDualWriterMode3(legacy LegacyStorage, storage Storage) *DualWriterMode3 {
	return &DualWriterMode3{*NewDualWriter(legacy, storage)}
}

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode3) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Creater)
	if !ok {
		return nil, errDualWriterCreaterMissing
	}

	created, err := d.Storage.Create(ctx, obj, createValidation, options)
	if err != nil {
		klog.FromContext(ctx).Error(err, "unable to create object in Storage", "mode", 3)
		return created, err
	}

	if _, err := legacy.Create(ctx, obj, createValidation, options); err != nil {
		klog.FromContext(ctx).Error(err, "unable to create object in legacy storage", "mode", 3)
	}
	return created, nil
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from Storage.
func (d *DualWriterMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Storage.Get(ctx, name, &metav1.GetOptions{})
}

func (d *DualWriterMode3) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	legacy, ok := d.Legacy.(rest.GracefulDeleter)
	if !ok {
		return nil, false, errDualWriterDeleterMissing
	}

	deleted, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			klog.FromContext(ctx).Error(err, "could not delete from unified store", "mode", Mode3)
			return deleted, async, err
		}
	}

	_, _, errLS := legacy.Delete(ctx, name, deleteValidation, options)
	if errLS != nil {
		if !apierrors.IsNotFound(errLS) {
			klog.FromContext(ctx).Error(errLS, "could not delete from legacy store", "mode", Mode3)
		}
	}

	return deleted, async, err
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *DualWriterMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	updated, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	objInfo = &updateWrapper{
		upstream: objInfo,
		updated:  updated,
	}

	obj, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		klog.FromContext(ctx).Error(err, "could not write to US", "mode", Mode3)
		return obj, created, err
	}

	legacy, ok := d.Legacy.(rest.Updater)
	if !ok {
		klog.FromContext(ctx).Error(errDualWriterUpdaterMissing, "legacy storage update not implemented")
		return obj, created, err
	}

	_, _, errLeg := legacy.Update(ctx, name, &updateWrapper{
		upstream: objInfo,
		updated:  obj,
	}, createValidation, updateValidation, forceAllowCreate, options)
	if errLeg != nil {
		klog.FromContext(ctx).Error(errLeg, "could not update object in legacy store", "mode", Mode3)
	}
	return obj, created, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *DualWriterMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.CollectionDeleter)
	if !ok {
		return nil, errDualWriterCollectionDeleterMissing
	}

	// #TODO: figure out how to handle partial deletions
	deleted, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		klog.FromContext(ctx).Error(err, "failed to delete collection successfully from Storage", "deletedObjects", deleted)
	}

	if deleted, err := legacy.DeleteCollection(ctx, deleteValidation, options, listOptions); err != nil {
		klog.FromContext(ctx).Error(err, "failed to delete collection successfully from LegacyStorage", "deletedObjects", deleted)
	}

	return deleted, err
}

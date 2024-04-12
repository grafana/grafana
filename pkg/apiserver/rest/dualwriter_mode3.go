package rest

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

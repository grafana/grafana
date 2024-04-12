package rest

import (
	"context"
	"fmt"

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

// Get overrides the default behavior of the Storage and retrieves an object from Unified Storage
// the object is still fetched from Legacy Storage if it's not found in Unified Storage
func (d *DualWriterMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Getter)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Getter is missing")
	}

	s, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err == nil {
		return s, err
	}
	if !apierrors.IsNotFound(err) {
		return nil, err
	}

	klog.Info("object not found in unified storage. Getting it from legacy", "name", name)

	return legacy.Get(ctx, name, &metav1.GetOptions{})
}

package rest

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog"
)

type DualWriterMode3 struct {
	DualWriter
}

// NewDualWriterMode3 returns a new DualWriter in mode 2.
func NewDualWriterMode3(legacy LegacyStorage, storage Storage) *DualWriterMode3 {
	return &DualWriterMode3{*newDualWriter(legacy, storage)}
}

// Create overrides the default behavior of the Storage and writes to LegacyStorage and Storage depending on the dual writer mode.
func (d *DualWriterMode3) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	created, err := d.Storage.Create(ctx, obj, createValidation, options)
	if err != nil {
		return created, err
	}

	if _, err := legacy.Create(ctx, obj, createValidation, options); err != nil {
		klog.Error("unable to create object in legacy storage", "error", err)
	}
	return created, nil
}

// Update overrides the default behavior of the Storage and writes to both the LegacyStorage and Storage depending on the DualWriter mode.
func (d *DualWriterMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	legacy, ok := d.legacy.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("legacy storage rest.Updater is missing")
	}

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
		return obj, created, err
	}
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return nil, false, err
	}

	accessor.SetUID("")
	accessor.SetResourceVersion("")
	return legacy.Update(ctx, name, &updateWrapper{
		upstream: objInfo,
		updated:  obj,
	}, createValidation, updateValidation, forceAllowCreate, options)
}

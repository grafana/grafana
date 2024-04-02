package rest

import (
	"context"
	"fmt"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type DualWriterMode1 struct {
	DualWriter
}

// NewDualWriterMode1 returns a new DualWriter in mode 1.
func NewDualWriterMode1(legacy LegacyStorage, storage Storage) *DualWriterMode1 {
	return &DualWriterMode1{*newDualWriter(legacy, storage)}
}

func (d *DualWriterMode1) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	return legacy.Create(ctx, obj, createValidation, options)
}

func (d *DualWriterMode1) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	legacy, ok := d.legacy.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("legacy storage rest.Updater is missing")
	}

	return legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (d *DualWriterMode1) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Getter)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	return legacy.Get(ctx, name, options)
}

func (d *DualWriterMode1) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	return legacy.List(ctx, options)
}

func (d *DualWriterMode1) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	legacy, ok := d.legacy.(rest.GracefulDeleter)
	if !ok {
		return nil, false, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	return legacy.Delete(ctx, name, deleteValidation, options)
}

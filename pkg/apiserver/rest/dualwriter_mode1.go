package rest

import (
	"context"
	"errors"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode1 struct {
	DualWriter
}

var errNoCreaterMethod = errors.New("legacy storage rest.Creater is missing")
var noDeleteMethod = errors.New("legacy storage rest.Deleter is missing")

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to and reading from LegacyStorage.
func NewDualWriterMode1(legacy LegacyStorage, storage Storage) *DualWriterMode1 {
	return &DualWriterMode1{*NewDualWriter(legacy, storage)}
}

// Create overrides the behavior of the generic DualWriter and writes only to LegacyStorage.
func (d *DualWriterMode1) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Creater)
	if !ok {
		klog.FromContext(ctx).Error(errDualWriterCreaterMissing, "legacy storage rest.Creater is missing")
		return nil, errDualWriterCreaterMissing
	}

	return legacy.Create(ctx, obj, createValidation, options)
}

// Get overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Legacy.Get(ctx, name, options)
}

// List overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Lister)
	if !ok {
		return nil, errDualWriterListerMissing
	}

	return legacy.List(ctx, options)
}

func (d *DualWriterMode1) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	legacy, ok := d.Legacy.(rest.GracefulDeleter)
	if !ok {
		return nil, false, noDeleteMethod
	}

	return legacy.Delete(ctx, name, deleteValidation, options)
}

package rest

import (
	"context"
	"errors"
	"fmt"

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

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to and reading from LegacyStorage.
func NewDualWriterMode1(legacy LegacyStorage, storage Storage) *DualWriterMode1 {
	return &DualWriterMode1{*NewDualWriter(legacy, storage)}
}

// Create overrides the generic DualWriter Create method and writes only to LegacyStorage.
func (d *DualWriterMode1) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Creater)
	if !ok {
		klog.FromContext(ctx).Error(errNoCreaterMethod, "legacy storage rest.Creater is missing")
		return nil, errNoCreaterMethod
	}

	return legacy.Create(ctx, obj, createValidation, options)
}

// Get overrides the default behavior of the DualWriter and reads only to LegacyStorage.
func (d *DualWriterMode1) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Legacy.Get(ctx, name, options)
}

// List overrides the generic DualWriter List method and reads only from LegacyStorage.
func (d *DualWriterMode1) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Lister is missing")
	}

	return legacy.List(ctx, options)
}

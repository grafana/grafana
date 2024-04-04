package rest

import (
	"context"
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode1 struct {
	DualWriter
}

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to and reading from LegacyStorage.
func NewDualWriterMode1(legacy LegacyStorage, storage Storage) *DualWriterMode1 {
	return &DualWriterMode1{*NewDualWriter(legacy, storage)}
}

// Create overrides the default behavior of the DualWriter and writes only to LegacyStorage.
func (d *DualWriterMode1) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Creater)
	if !ok {
		err := errors.New("legacy storage rest.Creater is missing")
		klog.FromContext(ctx).Error(err, "legacy storage rest.Creater is missing")
		return nil, err
	}

	return legacy.Create(ctx, obj, createValidation, options)
}

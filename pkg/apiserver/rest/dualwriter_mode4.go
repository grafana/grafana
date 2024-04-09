package rest

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type DualWriterMode4 struct {
	DualWriter
}

// NewDualWriterMode4 returns a new DualWriter in mode 4.
// Mode 4 represents writing and reading from Storage.
func NewDualWriterMode4(legacy LegacyStorage, storage Storage) *DualWriterMode4 {
	return &DualWriterMode4{*NewDualWriter(legacy, storage)}
}

// #TODO remove all DualWriterMode4 methods once we remove the generic DualWriter implementation

// Create overrides the default behavior of the generic DualWriter and writes only to Storage.
func (d *DualWriterMode4) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return d.Storage.Create(ctx, obj, createValidation, options)
}

// Get overrides the default behavior of the Storage and retrieves an object from Unified Storage
func (d *DualWriterMode4) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Storage.Get(ctx, name, &metav1.GetOptions{})
}

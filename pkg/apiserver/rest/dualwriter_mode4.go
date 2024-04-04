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
	return &DualWriterMode4{*newDualWriter(legacy, storage)}
}

// Create overrides the default behavior of the DualWriter and writes only to Storage.
// #TODO remove this once we remove the default DualWriter implementation
func (d *DualWriterMode4) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return d.Storage.Create(ctx, obj, createValidation, options)
}

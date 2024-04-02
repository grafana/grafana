package rest

import (
	"context"
	"fmt"

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

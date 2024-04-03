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

type DualWriterMode2 struct {
	DualWriter
}

// NewDualWriterMode2 returns a new DualWriter in mode 2.
// Mode 2 represents writing to LegacyStorage and Storage and reading from LegacyStorage.
func NewDualWriterMode2(legacy LegacyStorage, storage Storage) *DualWriterMode2 {
	return &DualWriterMode2{*newDualWriter(legacy, storage)}
}

// Create overrides the default behavior of the DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode2) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	created, err := legacy.Create(ctx, obj, createValidation, options)
	if err != nil {
		return created, err
	}

	c, err := enrichObject(obj, created)
	if err != nil {
		return created, err
	}

	accessor, err := meta.Accessor(c)
	if err != nil {
		return created, err
	}
	accessor.SetResourceVersion("")
	accessor.SetUID("")

	rsp, err := d.Storage.Create(ctx, c, createValidation, options)
	if err != nil {
		klog.Error("unable to create object in duplicate storage", "error", err, "mode", Mode2)
	}
	return rsp, err
}

func enrichObject(orig, copy runtime.Object) (runtime.Object, error) {
	accessorC, err := meta.Accessor(copy)
	if err != nil {
		return nil, err
	}
	accessorO, err := meta.Accessor(orig)
	if err != nil {
		return nil, err
	}

	accessorC.SetLabels(accessorO.GetLabels())

	ac := accessorC.GetAnnotations()
	for k, v := range accessorO.GetAnnotations() {
		ac[k] = v
	}
	accessorC.SetAnnotations(ac)

	// #TODO set resource version and UID when required (Update for example)
	// accessorC.SetResourceVersion(accessorO.GetResourceVersion())

	// accessorC.SetUID(accessorO.GetUID())

	return copy, nil
}

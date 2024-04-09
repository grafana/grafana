package rest

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode2 struct {
	DualWriter
}

// NewDualWriterMode2 returns a new DualWriter in mode 2.
// Mode 2 represents writing to LegacyStorage and Storage and reading from LegacyStorage.
func NewDualWriterMode2(legacy LegacyStorage, storage Storage) *DualWriterMode2 {
	return &DualWriterMode2{*NewDualWriter(legacy, storage)}
}

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode2) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	created, err := legacy.Create(ctx, obj, createValidation, options)
	if err != nil {
		klog.FromContext(ctx).Error(err, "unable to create object in legacy storage", "mode", 2)
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

	// create method expects an empty resource version
	accessor.SetResourceVersion("")
	accessor.SetUID("")

	rsp, err := d.Storage.Create(ctx, c, createValidation, options)
	if err != nil {
		klog.FromContext(ctx).Error(err, "unable to create object in Storage", "mode", 2)
	}
	return rsp, err
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from LegacyStorage.
func (d *DualWriterMode2) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Legacy.Get(ctx, name, &metav1.GetOptions{})
}

// List overrides the behavior of the generic DualWriter.
// It returns Storage entries if possible and falls back to LegacyStorage entries if not.
func (d *DualWriterMode2) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.Legacy.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Lister is missing")
	}

	ll, err := legacy.List(ctx, options)
	if err != nil {
		return nil, err
	}
	legacyList, err := meta.ExtractList(ll)
	if err != nil {
		return nil, err
	}

	sl, err := d.Storage.List(ctx, options)
	if err != nil {
		return nil, err
	}
	storageList, err := meta.ExtractList(sl)
	if err != nil {
		return nil, err
	}

	m := map[string]int{}
	for i, obj := range storageList {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		m[accessor.GetName()] = i
	}

	for i, obj := range legacyList {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		// Replace the LegacyStorage object if there's a corresponding entry in Storage.
		if index, ok := m[accessor.GetName()]; ok {
			legacyList[i] = storageList[index]
		}
	}

	if err = meta.SetList(ll, legacyList); err != nil {
		return nil, err
	}
	return ll, nil
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

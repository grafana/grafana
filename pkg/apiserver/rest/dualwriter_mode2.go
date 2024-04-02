package rest

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog"
)

type DualWriterMode2 struct {
	DualWriter
}

// NewDualWriterMode2 returns a new DualWriter in mode 2.
func NewDualWriterMode2(legacy LegacyStorage, storage Storage) *DualWriterMode2 {
	return &DualWriterMode2{*newDualWriter(legacy, storage)}
}

// Get overrides the default behavior of the Storage and retrieves an object from
// LegacyStorage or Storage depending on the DualWriter mode.
func (d *DualWriterMode2) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Getter)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Getter is missing")
	}

	s, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err == nil {
		return s, err
	}
	if !apierrors.IsNotFound(err) {
		return nil, err
	}

	return legacy.Get(ctx, name, &metav1.GetOptions{})
}

// List overrides the default behavior of the Storage and retrieves objects from
// LegacyStorage or Storage depending on the DualWriter mode.
func (d *DualWriterMode2) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Lister)
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

	enriched := []runtime.Object{}

	m := map[string]int{}
	for i, obj := range storageList {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		m[accessor.GetName()] = i
	}

	for _, obj := range legacyList {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		// Enrich the legacy object if it has a corresponding entry in storage.
		if index, ok := m[accessor.GetName()]; ok {
			c, err := enrichObject(storageList[index], obj)
			if err != nil {
				return nil, err
			}
			enriched = append(enriched, c)
		} else { // Otherwise include it as is.
			enriched = append(enriched, obj)
		}
	}

	if err = meta.SetList(ll, enriched); err != nil {
		return nil, err
	}
	return ll, nil
}

// Create overrides the default behavior of the Storage and writes to LegacyStorage and Storage depending on the dual writer mode.
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

// Update overrides the default behavior of the Storage and writes to both the LegacyStorage and Storage depending on the DualWriter mode.
func (d *DualWriterMode2) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	legacy, ok := d.legacy.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("legacy storage rest.Updater is missing")
	}

	// Get the previous version
	var old runtime.Object
	old, err := d.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	// #TODO: in tests why does old have resource version but not updated?

	accessor, err := meta.Accessor(old)
	if err != nil {
		return nil, false, err
	}
	// Hold on to the RV+UID for the dual write
	theRV := accessor.GetResourceVersion()
	theUID := accessor.GetUID()

	// Changes applied within new storage
	// will fail if RV is out of sync
	updated, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	obj, created, err := legacy.Update(ctx, name, &updateWrapper{
		upstream: objInfo,
		updated:  updated, // returned as the object that will be updated
	}, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return obj, created, err
	}

	o, err := enrichObject(updated, obj)
	if err != nil {
		return obj, false, err
	}

	accessor, err = meta.Accessor(o)
	if err != nil {
		return nil, false, err
	}
	accessor.SetResourceVersion(theRV) // the original RV
	accessor.SetUID(theUID)
	objInfo = &updateWrapper{
		upstream: objInfo,
		updated:  o, // returned as the object that will be updated
	}

	// #TODO: relies on GuaranteedUpdate creating the object if
	// it doesn't exist: https://github.com/grafana/grafana/pull/85206
	return d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
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

	accessorC.SetResourceVersion(accessorO.GetResourceVersion())

	accessorC.SetUID(accessorO.GetUID())

	return copy, nil
}

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

// #TODO: the other methods still work because we are embedding dualwriter right?
// better way to create a mode 2 dual writer?
// #TODO add /update documentation comments

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

	l, err := legacy.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	s, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		// #TODO error handling
		return l, nil
	}

	accessorL, err := meta.Accessor(l)
	if err != nil {
		return l, err
	}

	accessorS, err := meta.Accessor(s)
	if err != nil {
		return l, err
	}

	// #TODO: figure out if we want to set anything else
	accessorL.SetResourceVersion(accessorS.GetResourceVersion())
	return l, nil
}

// List overrides the default behavior of the Storage and retrieves objects from
// LegacyStorage or Storage depending on the DualWriter mode.
func (d *DualWriterMode2) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Lister is missing")
	}

	legacyList, err := legacy.List(ctx, options)
	if err != nil {
		return nil, err
	}
	ll, err := meta.ExtractList(legacyList)
	if err != nil {
		return nil, err
	}

	// #TODO if no entries are found will we get an error?
	storageList, err := d.Storage.List(ctx, options)
	if err != nil {
		return nil, err
	}
	sl, err := meta.ExtractList(storageList)
	if err != nil {
		return nil, err
	}

	// #TODO: define this type separately?
	// #TODO: figure out what other fields we want
	type fieldsToEnrich struct {
		resourceVersion string
	}

	// #TODO: is there a better way to do this than create this intermediate map?
	// Look into whether GetContinue()/EachListItem() could help
	m := map[string]fieldsToEnrich{}
	for _, obj := range sl {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		// #TODO: is name the best identification for this use case?
		// #TODO: figure out if we want to set anything else
		m[accessor.GetName()] = fieldsToEnrich{accessor.GetResourceVersion()}
	}

	// #TODO see if it would make more sense to have a more general merge function where
	// one gets prioritised for resource version etc
	for _, obj := range ll {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		if entry, ok := m[accessor.GetName()]; ok {
			accessor.SetResourceVersion(entry.resourceVersion)
		}
	}

	if err = meta.SetList(legacyList, ll); err != nil {
		return nil, err
	}
	return legacyList, nil
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

	// #TODO check where we want to do the clearing of RV and UID
	accessor, err := meta.Accessor(created)
	if err != nil {
		return created, err
	}
	accessor.SetResourceVersion("")
	accessor.SetUID("")

	rsp, err := d.Storage.Create(ctx, created, createValidation, options)
	if err != nil {
		klog.Error("unable to create object in duplicate storage", "error", err, "mode", Mode2)
	}
	return rsp, err
}

// Update overrides the default behavior of the Storage and writes to both the LegacyStorage and Storage depending on the DualWriter mode.
func (d *DualWriterMode2) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// #TODO: figure out which method should be used anytime Get is called
	// #TODO figure out failure modes, how to guarantee consistency of the updates across both stores
	// #TODO replace with a rest.CreaterUpdater check?
	legacy, ok := d.legacy.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("legacy storage rest.Updater is missing")
	}

	// #TODO figure out how to set opts.IgnoreNotFound = true here
	// or how to specifically check for an apierrors.NewNotFound error
	// #TODO for now assume that we are updating entities which had previously
	// created in entity. GuaranteedUpdate is going to take into account this case:
	// https://github.com/grafana/grafana/pull/85206
	// #TODO figure out wht the correct resource version should be and
	// set it properly in Get and List calls
	// Get the previous version from k8s storage (the one)
	var old runtime.Object
	old, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			// #TODO figure out what the resource version and UIDs should be in this case
			_, ok := d.legacy.(rest.Getter)
			if !ok {
				return nil, false, fmt.Errorf("legacy storage rest.Getter is missing")
			}

			old, err = d.legacy.Get(ctx, name, &metav1.GetOptions{})
			if err != nil {
				return nil, false, err
			}
		} else {
			return nil, false, err
		}
	}

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
	accessor, err = meta.Accessor(updated)
	if err != nil {
		return nil, false, err
	}

	accessor.SetUID("")             // clear it
	accessor.SetResourceVersion("") // remove it so it is not a constraint
	obj, created, err := legacy.Update(ctx, name, &updateWrapper{
		upstream: objInfo,
		updated:  updated, // returned as the object that will be updated
	}, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return obj, created, err
	}

	accessor, err = meta.Accessor(obj)
	if err != nil {
		return nil, false, err
	}
	accessor.SetResourceVersion(theRV) // the original RV
	accessor.SetUID(theUID)
	objInfo = &updateWrapper{
		upstream: objInfo,
		updated:  obj, // returned as the object that will be updated
	}

	return d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

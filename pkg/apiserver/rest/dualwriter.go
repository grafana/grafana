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

var (
	_ rest.Storage              = (*DualWriter)(nil)
	_ rest.Scoper               = (*DualWriter)(nil)
	_ rest.TableConvertor       = (*DualWriter)(nil)
	_ rest.CreaterUpdater       = (*DualWriter)(nil)
	_ rest.CollectionDeleter    = (*DualWriter)(nil)
	_ rest.GracefulDeleter      = (*DualWriter)(nil)
	_ rest.SingularNameProvider = (*DualWriter)(nil)
)

// Storage is a storage implementation that satisfies the same interfaces as genericregistry.Store.
type Storage interface {
	rest.Storage
	rest.StandardStorage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
	rest.Getter
}

// LegacyStorage is a storage implementation that writes to the Grafana SQL database.
type LegacyStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.TableConvertor
	rest.Getter
}

// DualWriter is a storage implementation that writes first to LegacyStorage and then to Storage.
// If writing to LegacyStorage fails, the write to Storage is skipped and the error is returned.
// Storage is used for all read operations.  This is useful as a migration step from SQL based
// legacy storage to a more standard kubernetes backed storage interface.
//
// NOTE: Only values supported by legacy storage will be preserved in the CREATE/UPDATE commands.
// For example, annotations, labels, and managed fields may not be preserved.  Everything in upstream
// storage can be recrated from the data in legacy storage.
//
// The LegacyStorage implementation must implement the following interfaces:
// - rest.Storage
// - rest.TableConvertor
// - rest.Scoper
// - rest.SingularNameProvider
//
// These interfaces are optional, but they all should be implemented to fully support dual writes:
// - rest.Creater
// - rest.Updater
// - rest.GracefulDeleter
// - rest.CollectionDeleter
type DualWriter struct {
	Storage
	legacy LegacyStorage
}

type DualWriterMode int

const (
	Mode1 DualWriterMode = iota
	Mode2
	Mode3
	Mode4
)

const CurrentMode = Mode2

// #TODO: make CurrentMode customisable

// NewDualWriter returns a new DualWriter.
func NewDualWriter(legacy LegacyStorage, storage Storage) *DualWriter {
	return &DualWriter{
		Storage: storage,
		legacy:  legacy,
	}
}

// Create overrides the default behavior of the Storage and writes to LegacyStorage and Storage depending on the dual writer mode.
func (d *DualWriter) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	legacy, ok := d.legacy.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("legacy storage rest.Creater is missing")
	}

	created, err := legacy.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}

	if CurrentMode < Mode2 {
		return created, nil
	}

	rsp, err := d.Storage.Create(ctx, created, createValidation, options)
	// #TODO customise error handling depending on the mode we are in
	if err != nil {
		klog.Error("unable to create object in duplicate storage", "error", err)
	}
	return rsp, err
}

// #TODO figure out failure modes, how to guarantee consistency of the transactions
// Update overrides the default behavior of the Storage and writes to both the LegacyStorage and Storage depending on the DualWriter mode.
func (d *DualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// #TODO replace with a rest.CreaterUpdater check?
	legacy, ok := d.legacy.(rest.Updater)
	if !ok {
		return nil, false, fmt.Errorf("legacy storage rest.Updater is missing")
	}

	// #TODO: Doing it the repetitive way first. Refactor once all the behavior is well defined.
	switch CurrentMode {
	case Mode1:
		old, err := d.legacy.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, false, err
		}

		updated, err := objInfo.UpdatedObject(ctx, old)
		if err != nil {
			return nil, false, err
		}
		accessor, err := meta.Accessor(updated)
		if err != nil {
			return nil, false, err
		}

		accessor.SetUID("")
		accessor.SetResourceVersion("")
		// #TODO check how much we need to do before legacy.Update for mode 1
		return legacy.Update(ctx, name, &updateWrapper{
			upstream: objInfo,
			updated:  updated,
		}, createValidation, updateValidation, forceAllowCreate, options)

	case Mode2:
		// #TODO figure out how to set opts.IgnoreNotFound = true here
		// or how to specifically check for an apierrors.NewNotFound error
		// #TODO for now assume that we are updating entities which had previously
		// created in entity. GuaranteedUpdate is going to take into account this case:
		// https://github.com/grafana/grafana/pull/85206
		// #TODO figure out wht the correct resource version should be and
		// set it properly in Get and List calls
		// Get the previous version from k8s storage (the one)
		old, err := d.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, false, err
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

	case Mode3:
		old, err := d.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, false, err
		}

		updated, err := objInfo.UpdatedObject(ctx, old)
		if err != nil {
			return nil, false, err
		}
		objInfo = &updateWrapper{
			upstream: objInfo,
			updated:  updated,
		}

		obj, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
		if err != nil {
			return obj, created, err
		}
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, false, err
		}

		accessor.SetUID("")
		accessor.SetResourceVersion("")
		// #TODO do we still need to use objInfo.UpdatedObject?
		return legacy.Update(ctx, name, &updateWrapper{
			upstream: objInfo,
			updated:  obj,
		}, createValidation, updateValidation, forceAllowCreate, options)

	case Mode4:
		old, err := d.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, false, err
		}

		updated, err := objInfo.UpdatedObject(ctx, old)
		if err != nil {
			return nil, false, err
		}

		objInfo = &updateWrapper{
			upstream: objInfo,
			updated:  updated,
		}
		return d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	}

	return nil, false, fmt.Errorf("dual writer mode is undefined")
}

// Delete overrides the default behavior of the Storage and delete from both the LegacyStorage and Storage.
func (d *DualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// Delete from storage *first* so the item is still exists if a failure happens
	obj, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err == nil {
		if legacy, ok := d.legacy.(rest.GracefulDeleter); ok {
			obj, async, err = legacy.Delete(ctx, name, deleteValidation, options)
		}
	}
	return obj, async, err
}

// DeleteCollection overrides the default behavior of the Storage and delete from both the LegacyStorage and Storage.
func (d *DualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	out, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err == nil {
		if legacy, ok := d.legacy.(rest.CollectionDeleter); ok {
			out, err = legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
		}
	}
	return out, err
}

type updateWrapper struct {
	upstream rest.UpdatedObjectInfo
	updated  runtime.Object
}

// Returns preconditions built from the updated object, if applicable.
// May return nil, or a preconditions object containing nil fields,
// if no preconditions can be determined from the updated object.
func (u *updateWrapper) Preconditions() *metav1.Preconditions {
	return u.upstream.Preconditions()
}

// UpdatedObject returns the updated object, given a context and old object.
// The only time an empty oldObj should be passed in is if a "create on update" is occurring (there is no oldObj).
func (u *updateWrapper) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) {
	return u.updated, nil
}

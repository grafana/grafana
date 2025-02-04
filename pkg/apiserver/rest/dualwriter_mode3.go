package rest

import (
	"context"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode3 struct {
	Legacy   LegacyStorage
	Storage  Storage
	watchImp rest.Watcher // watch is only available in mode 3 and 4
	*dualWriterMetrics
	resource string
	Log      klog.Logger
}

// newDualWriterMode3 returns a new DualWriter in mode 3.
// Mode 3 represents writing to LegacyStorage and Storage and reading from Storage.
func newDualWriterMode3(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics, resource string) *DualWriterMode3 {
	return &DualWriterMode3{
		Legacy:            legacy,
		Storage:           storage,
		Log:               klog.NewKlogr().WithName("DualWriterMode3").WithValues("mode", mode3Str, "resource", resource),
		dualWriterMetrics: dwm,
		resource:          resource,
	}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode3) Mode() DualWriterMode {
	return Mode3
}

const mode3Str = "3"

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode3) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	var method = "create"
	log := d.Log.WithValues("method", method)

	ctx = klog.NewContext(ctx, log)

	accIn, err := meta.Accessor(in)
	if err != nil {
		return nil, err
	}

	if accIn.GetUID() != "" {
		return nil, fmt.Errorf("UID should not be: %v", accIn.GetUID())
	}

	if accIn.GetName() == "" && accIn.GetGenerateName() == "" {
		return nil, fmt.Errorf("name or generatename have to be set")
	}

	// create in legacy first, and then unistore. if unistore fails, but legacy succeeds,
	// will try to cleanup the object in legacy.

	startLegacy := time.Now()
	createdFromLegacy, err := d.Legacy.Create(ctx, in, createValidation, options)
	if err != nil {
		log.Error(err, "unable to create object in legacy storage")
		d.recordLegacyDuration(true, mode2Str, d.resource, method, startLegacy)
		return createdFromLegacy, err
	}
	d.recordLegacyDuration(false, mode2Str, d.resource, method, startLegacy)

	createdCopy := createdFromLegacy.DeepCopyObject()
	accCreated, err := meta.Accessor(createdCopy)
	if err != nil {
		return createdFromLegacy, err
	}
	accCreated.SetResourceVersion("")

	startStorage := time.Now()
	storageObj, errObjectSt := d.Storage.Create(ctx, createdCopy, createValidation, options)
	d.recordStorageDuration(errObjectSt != nil, mode3Str, d.resource, method, startStorage)
	if errObjectSt != nil {
		log.Error(err, "unable to create object in storage")

		// if we cannot create in unistore, attempt to clean up legacy
		_, _, err = d.Legacy.Delete(ctx, accCreated.GetName(), nil, &metav1.DeleteOptions{})
		if err != nil {
			log.Error(err, "unable to cleanup object in legacy storage")
		}

		return storageObj, errObjectSt
	}

	areEqual := Compare(createdFromLegacy, storageObj)
	d.recordOutcome(mode3Str, getName(storageObj), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return storageObj, errObjectSt
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from Storage.
func (d *DualWriterMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	var method = "get"
	log := d.Log.WithValues("name", name, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	storageObj, err := d.Storage.Get(ctx, name, options)
	d.recordStorageDuration(err != nil, mode3Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to get object in storage")
	}

	//nolint:errcheck
	go d.getFromLegacyStorage(ctx, storageObj, name, options)

	return storageObj, err
}

func (d *DualWriterMode3) getFromLegacyStorage(ctx context.Context, storageObj runtime.Object, name string, options *metav1.GetOptions) error {
	var method = "get"
	log := d.Log.WithValues("method", method, "name", name)

	startLegacy := time.Now()
	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("legacy get timeout"))
	defer cancel()

	objFromLegacy, err := d.Legacy.Get(ctx, name, options)
	d.recordLegacyDuration(err != nil, mode3Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to get object in legacy storage")
		cancel()
	}

	areEqual := Compare(storageObj, objFromLegacy)
	d.recordOutcome(mode3Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}
	return err
}

// List overrides the behavior of the generic DualWriter and reads only from Unified Store.
func (d *DualWriterMode3) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "list"
	log := d.Log.WithValues("resourceVersion", options.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	objFromStorage, err := d.Storage.List(ctx, options)
	d.recordStorageDuration(err != nil, mode3Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to list object in storage")
	}

	//nolint:errcheck
	go d.listFromLegacyStorage(ctx, options, objFromStorage)

	return objFromStorage, err
}

func (d *DualWriterMode3) listFromLegacyStorage(ctx context.Context, options *metainternalversion.ListOptions, objFromStorage runtime.Object) error {
	var method = "list"
	log := d.Log.WithValues("resourceVersion", options.ResourceVersion, "method", method)
	startLegacy := time.Now()

	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("legacy list timeout"))
	defer cancel()

	objFromLegacy, err := d.Legacy.List(ctx, options)
	d.recordLegacyDuration(err != nil, mode3Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to list object in legacy storage")
		cancel()
	}

	areEqual := Compare(objFromStorage, objFromLegacy)
	d.recordOutcome(mode3Str, getName(objFromStorage), areEqual, method)
	if !areEqual {
		log.WithValues("name", getName(objFromStorage)).Info("object from legacy and storage are not equal")
	}

	return err
}

func (d *DualWriterMode3) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	var method = "delete"
	log := d.Log.WithValues("name", name, "method", method)
	ctx = klog.NewContext(ctx, d.Log)

	// delete from legacy first, and then unistore. Will return a failure if either fails,
	// unless its a 404.
	//
	// we want to delete from legacy first, otherwise if the delete from unistore was successful,
	// but legacy failed, the user would get a failure, but not be able to retry the delete
	// as they would not be able to see the object in unistore anymore.

	startLegacy := time.Now()
	objFromLegacy, asyncLegacy, err := d.Legacy.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.WithValues("object", objFromLegacy).Error(err, "could not delete from legacy store")
			d.recordLegacyDuration(true, mode3Str, d.resource, method, startLegacy)
			return objFromLegacy, asyncLegacy, err
		}
	}
	d.recordLegacyDuration(false, mode3Str, d.resource, method, startLegacy)

	startStorage := time.Now()
	objFromStorage, asyncStorage, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.WithValues("object", objFromStorage).Error(err, "could not delete from storage")
			d.recordStorageDuration(true, mode3Str, d.resource, method, startStorage)
		}
		return objFromStorage, asyncStorage, err
	}
	d.recordStorageDuration(false, mode3Str, d.resource, method, startStorage)

	areEqual := Compare(objFromStorage, objFromLegacy)
	d.recordOutcome(mode3Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}

	return objFromStorage, asyncStorage, err
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *DualWriterMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	var method = "update"
	log := d.Log.WithValues("name", name, "method", method)
	ctx = klog.NewContext(ctx, log)
	// The incoming RV is not stable -- it may be from legacy or storage!
	// This sets a flag in the context and our apistore is more lenient when it exists
	ctx = context.WithValue(ctx, dualWriteContextKey{}, true)

	// update in legacy first, and then unistore. Will return a failure if either fails.
	//
	// we want to update in legacy first, otherwise if the update from unistore was successful,
	// but legacy failed, the user would get a failure, but see the update did apply to the source
	// of truth, and be less likely to retry to save (and get the stores in sync again)

	startLegacy := time.Now()
	objFromLegacy, createdLegacy, err := d.Legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.WithValues("object", objFromLegacy).Error(err, "could not update in legacy storage")
		d.recordLegacyDuration(true, mode2Str, d.resource, "update", startLegacy)
		return objFromLegacy, createdLegacy, err
	}
	d.recordLegacyDuration(false, mode2Str, d.resource, "update", startLegacy)

	startStorage := time.Now()
	objFromStorage, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.WithValues("object", objFromStorage).Error(err, "could not update in storage")
		d.recordStorageDuration(true, mode2Str, d.resource, "update", startStorage)
		return objFromStorage, created, err
	}

	areEqual := Compare(objFromStorage, objFromLegacy)
	d.recordOutcome(mode3Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}

	return objFromStorage, created, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *DualWriterMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "delete-collection"
	log := d.Log.WithValues("resourceVersion", listOptions.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	// delete from legacy first, and anything that is successful can be deleted in unistore too.
	//
	// we want to delete from legacy first, otherwise if the delete from unistore was successful,
	// but legacy failed, the user would get a failure, but not be able to retry the delete
	// as they would not be able to see the object in unistore anymore.

	startLegacy := time.Now()
	deletedLegacy, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.WithValues("deleted", deletedLegacy).Error(err, "failed to delete collection successfully from legacy storage")
		d.recordLegacyDuration(true, mode3Str, d.resource, method, startLegacy)
		return deletedLegacy, err
	}
	d.recordLegacyDuration(false, mode3Str, d.resource, method, startLegacy)

	legacyList, err := meta.ExtractList(deletedLegacy)
	if err != nil {
		log.Error(err, "unable to extract list from legacy storage")
		return nil, err
	}

	// Only the items deleted by the legacy DeleteCollection call are selected for deletion by Storage.
	_, err = parseList(legacyList)
	if err != nil {
		return nil, err
	}

	startStorage := time.Now()
	deletedStorage, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.WithValues("deleted", deletedStorage).Error(err, "failed to delete collection successfully from Storage")
		d.recordStorageDuration(true, mode3Str, d.resource, method, startStorage)
		return deletedStorage, err
	}
	d.recordStorageDuration(false, mode3Str, d.resource, method, startStorage)

	areEqual := Compare(deletedStorage, deletedLegacy)
	d.recordOutcome(mode3Str, getName(deletedLegacy), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return deletedStorage, err
}

func (d *DualWriterMode3) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	var method = "watch"
	d.Log.WithValues("method", method, "mode", mode3Str).Info("starting to watch")
	return d.watchImp.Watch(ctx, options)
}

func (d *DualWriterMode3) Destroy() {
	d.Storage.Destroy()
	d.Legacy.Destroy()
}

func (d *DualWriterMode3) GetSingularName() string {
	return d.Storage.GetSingularName()
}

func (d *DualWriterMode3) NamespaceScoped() bool {
	return d.Storage.NamespaceScoped()
}

func (d *DualWriterMode3) New() runtime.Object {
	return d.Storage.New()
}

func (d *DualWriterMode3) NewList() runtime.Object {
	return d.Storage.NewList()
}

func (d *DualWriterMode3) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.Storage.ConvertToTable(ctx, object, tableOptions)
}

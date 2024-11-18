package rest

import (
	"context"
	"errors"
	"fmt"
	"time"

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

	startStorage := time.Now()
	storageObj, errObjectSt := d.Storage.Create(ctx, in, createValidation, options)
	d.recordStorageDuration(errObjectSt != nil, mode3Str, d.resource, method, startStorage)
	if errObjectSt != nil {
		log.Error(err, "unable to create object in storage")
		return storageObj, errObjectSt
	}

	createdCopy := storageObj.DeepCopyObject()

	//nolint:errcheck
	go d.createOnLegacyStorage(ctx, in, createdCopy, createValidation, options)

	return storageObj, errObjectSt
}

func (d *DualWriterMode3) createOnLegacyStorage(ctx context.Context, in, storageObj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) error {
	var method = "create"
	log := d.Log.WithValues("method", method)
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("legacy create timeout"))
	defer cancel()

	accessor, err := meta.Accessor(storageObj)
	if err != nil {
		return err
	}

	// clear the UID and ResourceVersion from the object before sending it to the legacy storage
	accessor.SetUID("")
	accessor.SetResourceVersion("")

	startLegacy := time.Now()
	legacyObj, err := d.Legacy.Create(ctx, storageObj, createValidation, options)
	d.recordLegacyDuration(err != nil, mode3Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to create object in legacy storage")
		cancel()
	}

	areEqual := Compare(legacyObj, storageObj)
	d.recordOutcome(mode3Str, getName(storageObj), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}
	return err
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

	startStorage := time.Now()
	objFromStorage, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	d.recordStorageDuration(err != nil, mode3Str, name, method, startStorage)
	if err != nil {
		log.Error(err, "unable to delete object in storage")
		return objFromStorage, async, err
	}

	//nolint:errcheck
	go d.deleteFromLegacyStorage(ctx, objFromStorage, name, deleteValidation, options)

	return objFromStorage, async, err
}

func (d *DualWriterMode3) deleteFromLegacyStorage(ctx context.Context, objFromStorage runtime.Object, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) error {
	var method = "delete"
	log := d.Log.WithValues("name", name, "method", method, "name", name)
	startLegacy := time.Now()

	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("legacy delete timeout"))
	defer cancel()

	objFromLegacy, _, err := d.Legacy.Delete(ctx, name, deleteValidation, options)
	d.recordLegacyDuration(err != nil, mode3Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to delete object in legacy storage")
		cancel()
	}
	areEqual := Compare(objFromStorage, objFromLegacy)
	d.recordOutcome(mode3Str, name, areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return err
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *DualWriterMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	var method = "update"
	log := d.Log.WithValues("name", name, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	objFromStorage, async, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	d.recordStorageDuration(err != nil, mode3Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to update in storage")
		return objFromStorage, async, err
	}

	//nolint:errcheck
	go d.updateOnLegacyStorageMode3(ctx, objFromStorage, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)

	return objFromStorage, async, err
}

func (d *DualWriterMode3) updateOnLegacyStorageMode3(ctx context.Context, storageObj runtime.Object, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) error {
	// The incoming RV is from unified storage, so legacy can ignore it
	ctx = context.WithValue(ctx, dualWriteContextKey{}, true)

	var method = "update"
	log := d.Log.WithValues("name", name, "method", method, "name", name)

	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("legacy update timeout"))
	startLegacy := time.Now()
	defer cancel()

	objLegacy, _, err := d.Legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	d.recordLegacyDuration(err != nil, mode3Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to update object in legacy storage")
		cancel()
	}

	areEqual := Compare(storageObj, objLegacy)
	d.recordOutcome(mode3Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}
	return err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *DualWriterMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "delete-collection"
	log := d.Log.WithValues("resourceVersion", listOptions.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	storageObj, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	d.recordStorageDuration(err != nil, mode3Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to delete collection in storage")
		return storageObj, err
	}

	//nolint:errcheck
	go d.deleteCollectionFromLegacyStorage(ctx, storageObj, deleteValidation, options, listOptions)

	return storageObj, err
}

func (d *DualWriterMode3) deleteCollectionFromLegacyStorage(ctx context.Context, storageObj runtime.Object, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) error {
	var method = "delete-collection"
	log := d.Log.WithValues("resourceVersion", listOptions.ResourceVersion, "method", method)
	startLegacy := time.Now()

	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("legacy deletecollection timeout"))
	defer cancel()

	legacyObj, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	d.recordLegacyDuration(err != nil, mode3Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to delete collection in legacy storage")
		cancel()
	}

	areEqual := Compare(storageObj, legacyObj)
	d.recordOutcome(mode3Str, getName(legacyObj), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return err
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

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
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode1 struct {
	Legacy  LegacyStorage
	Storage Storage
	*dualWriterMetrics
	resource string
	Log      klog.Logger
}

const mode1Str = "1"

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to and reading from LegacyStorage.
func newDualWriterMode1(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics, resource string) *DualWriterMode1 {
	return &DualWriterMode1{
		Legacy:            legacy,
		Storage:           storage,
		Log:               klog.NewKlogr().WithName("DualWriterMode1").WithValues("mode", mode1Str, "resource", resource),
		dualWriterMetrics: dwm,
		resource:          resource,
	}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode1) Mode() DualWriterMode {
	return Mode1
}

// Create overrides the behavior of the generic DualWriter and writes only to LegacyStorage.
func (d *DualWriterMode1) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	var method = "create"
	log := d.Log.WithValues("method", method)
	ctx = klog.NewContext(ctx, log)

	accIn, err := meta.Accessor(in)
	if err != nil {
		return nil, err
	}

	if accIn.GetUID() != "" {
		return nil, fmt.Errorf("UID should not be present:: %v", accIn.GetUID())
	}

	startLegacy := time.Now()
	created, err := d.Legacy.Create(ctx, in, createValidation, options)
	d.recordLegacyDuration(err != nil, mode1Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to create object in legacy storage")
		return created, err
	}

	createdCopy := created.DeepCopyObject()

	//nolint:errcheck
	go d.createOnUnifiedStorage(ctx, createValidation, createdCopy, options)

	return created, err
}

func (d *DualWriterMode1) createOnUnifiedStorage(ctx context.Context, createValidation rest.ValidateObjectFunc, createdCopy runtime.Object, options *metav1.CreateOptions) error {
	var method = "create"
	log := d.Log.WithValues("method", method)

	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("storage create timeout"))
	defer cancel()

	accCreated, err := meta.Accessor(createdCopy)
	if err != nil {
		return err
	}

	accCreated.SetResourceVersion("")

	startStorage := time.Now()
	storageObj, errObjectSt := d.Storage.Create(ctx, createdCopy, createValidation, options)
	d.recordStorageDuration(errObjectSt != nil, mode1Str, d.resource, method, startStorage)
	if errObjectSt != nil {
		log.Error(errObjectSt, "unable to create object in storage")
		cancel()
	}
	areEqual := Compare(storageObj, createdCopy)
	d.recordOutcome(mode1Str, getName(createdCopy), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return errObjectSt
}

// Get overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	var method = "get"
	log := d.Log.WithValues("method", method, "name", name)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	res, errLegacy := d.Legacy.Get(ctx, name, options)
	if errLegacy != nil {
		log.Error(errLegacy, "unable to get object in legacy storage")
	}
	d.recordLegacyDuration(errLegacy != nil, mode1Str, d.resource, method, startLegacy)

	//nolint:errcheck
	go d.getFromUnifiedStorage(ctx, res, name, options)

	return res, errLegacy
}

func (d *DualWriterMode1) getFromUnifiedStorage(ctx context.Context, objFromLegacy runtime.Object, name string, options *metav1.GetOptions) error {
	var method = "get"
	log := d.Log.WithValues("method", method, "name", name)

	startStorage := time.Now()
	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("storage get timeout"))
	defer cancel()
	storageObj, err := d.Storage.Get(ctx, name, options)
	d.recordStorageDuration(err != nil, mode1Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to get object in storage")
		cancel()
	}

	areEqual := Compare(storageObj, objFromLegacy)
	d.recordOutcome(mode1Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}

	return err
}

// List overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "list"
	log := d.Log.WithValues("resourceVersion", options.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	res, err := d.Legacy.List(ctx, options)
	d.recordLegacyDuration(err != nil, mode1Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to list object in legacy storage")
	}

	//nolint:errcheck
	go d.listFromUnifiedStorage(ctx, options, res)

	return res, err
}

func (d *DualWriterMode1) listFromUnifiedStorage(ctx context.Context, options *metainternalversion.ListOptions, objFromLegacy runtime.Object) error {
	var method = "list"
	log := d.Log.WithValues("resourceVersion", options.ResourceVersion, "method", method)

	startStorage := time.Now()
	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("storage list timeout"))
	defer cancel()

	storageObj, err := d.Storage.List(ctx, options)
	d.recordStorageDuration(err != nil, mode1Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to list objects from unified storage")
		cancel()
	}
	areEqual := Compare(storageObj, objFromLegacy)
	d.recordOutcome(mode1Str, getName(objFromLegacy), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return err
}

func (d *DualWriterMode1) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	var method = "delete"
	log := d.Log.WithValues("name", name, "method", method, "name", name)
	ctx = klog.NewContext(ctx, d.Log)

	startLegacy := time.Now()
	res, async, err := d.Legacy.Delete(ctx, name, deleteValidation, options)
	d.recordLegacyDuration(err != nil, mode1Str, name, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to delete object in legacy storage")
		return res, async, err
	}

	//nolint:errcheck
	go d.deleteFromUnifiedStorage(ctx, res, name, deleteValidation, options)

	return res, async, err
}

func (d *DualWriterMode1) deleteFromUnifiedStorage(ctx context.Context, res runtime.Object, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) error {
	var method = "delete"
	log := d.Log.WithValues("name", name, "method", method, "name", name)

	startStorage := time.Now()
	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("storage delete timeout"))
	defer cancel()
	storageObj, _, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	d.recordStorageDuration(err != nil, mode1Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to delete object from unified storage")
		cancel()
	}
	areEqual := Compare(storageObj, res)
	d.recordOutcome(mode1Str, name, areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes only from LegacyStorage.
func (d *DualWriterMode1) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "delete-collection"
	log := d.Log.WithValues("resourceVersion", listOptions.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	res, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	d.recordLegacyDuration(err != nil, mode1Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to delete collection in legacy storage")
		return res, err
	}

	//nolint:errcheck
	go d.deleteCollectionFromUnifiedStorage(ctx, res, deleteValidation, options, listOptions)

	return res, err
}

func (d *DualWriterMode1) deleteCollectionFromUnifiedStorage(ctx context.Context, res runtime.Object, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) error {
	var method = "delete-collection"
	log := d.Log.WithValues("resourceVersion", listOptions.ResourceVersion, "method", method)

	startStorage := time.Now()
	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("storage deletecollection timeout"))
	defer cancel()
	storageObj, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	d.recordStorageDuration(err != nil, mode1Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to delete collection object from unified storage")
		cancel()
	}
	areEqual := Compare(storageObj, res)
	d.recordOutcome(mode1Str, getName(res), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return err
}

func (d *DualWriterMode1) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	var method = "update"
	log := d.Log.WithValues("name", name, "method", method, "name", name)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	objLegacy, async, err := d.Legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	d.recordLegacyDuration(err != nil, mode1Str, d.resource, method, startLegacy)
	if err != nil {
		log.Error(err, "unable to update in legacy storage")
		return objLegacy, async, err
	}

	//nolint:errcheck
	go d.updateOnUnifiedStorageMode1(ctx, objLegacy, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)

	return objLegacy, async, err
}

func (d *DualWriterMode1) updateOnUnifiedStorageMode1(ctx context.Context, objLegacy runtime.Object, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) error {
	// The incoming RV is from legacy storage, so we can ignore it
	ctx = context.WithValue(ctx, dualWriteContextKey{}, true)

	var method = "update"
	log := d.Log.WithValues("name", name, "method", method, "name", name)

	// Ignores cancellation signals from parent context. Will automatically be canceled after 10 seconds.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(ctx), time.Second*10, errors.New("storage update timeout"))

	startStorage := time.Now()
	defer cancel()
	storageObj, _, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	d.recordStorageDuration(err != nil, mode1Str, d.resource, method, startStorage)
	if err != nil {
		log.Error(err, "unable to update object from unified storage")
		cancel()
	}
	areEqual := Compare(storageObj, objLegacy)
	d.recordOutcome(mode1Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}

	return err
}

func (d *DualWriterMode1) Destroy() {
	d.Storage.Destroy()
	d.Legacy.Destroy()
}

func (d *DualWriterMode1) GetSingularName() string {
	return d.Legacy.GetSingularName()
}

func (d *DualWriterMode1) NamespaceScoped() bool {
	return d.Legacy.NamespaceScoped()
}

func (d *DualWriterMode1) New() runtime.Object {
	return d.Legacy.New()
}

func (d *DualWriterMode1) NewList() runtime.Object {
	return d.Storage.NewList()
}

func (d *DualWriterMode1) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.Legacy.ConvertToTable(ctx, object, tableOptions)
}

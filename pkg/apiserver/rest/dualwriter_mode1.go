package rest

import (
	"context"
	"errors"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	Log klog.Logger
}

const mode1Str = "1"

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to and reading from LegacyStorage.
func newDualWriterMode1(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics) *DualWriterMode1 {
	return &DualWriterMode1{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode1"), dualWriterMetrics: dwm}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode1) Mode() DualWriterMode {
	return Mode1
}

// Create overrides the behavior of the generic DualWriter and writes only to LegacyStorage.
func (d *DualWriterMode1) Create(ctx context.Context, original runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	log := d.Log.WithValues("kind", options.Kind)
	ctx = klog.NewContext(ctx, log)
	var method = "create"

	startLegacy := time.Now()
	created, err := d.Legacy.Create(ctx, original, createValidation, options)
	if err != nil {
		log.Error(err, "unable to create object in legacy storage")
		d.recordLegacyDuration(true, mode1Str, options.Kind, method, startLegacy)
		return created, err
	}
	d.recordLegacyDuration(false, mode1Str, options.Kind, method, startLegacy)

	createdCopy := created.DeepCopyObject()

	go func() {
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("storage create timeout"))
		defer cancel()

		if err := enrichLegacyObject(original, createdCopy); err != nil {
			cancel()
		}

		startStorage := time.Now()
		_, errObjectSt := d.Storage.Create(ctx, createdCopy, createValidation, options)
		d.recordStorageDuration(errObjectSt != nil, mode1Str, options.Kind, method, startStorage)
	}()

	return created, err
}

// Get overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	log := d.Log.WithValues("kind", options.Kind)
	ctx = klog.NewContext(ctx, log)
	var method = "get"

	startLegacy := time.Now()
	res, errLegacy := d.Legacy.Get(ctx, name, options)
	if errLegacy != nil {
		log.Error(errLegacy, "unable to get object in legacy storage")
	}
	d.recordLegacyDuration(errLegacy != nil, mode1Str, options.Kind, method, startLegacy)

	go func() {
		startStorage := time.Now()
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("storage get timeout"))
		defer cancel()
		_, err := d.Storage.Get(ctx, name, options)
		d.recordStorageDuration(err != nil, mode1Str, options.Kind, method, startStorage)
	}()

	return res, errLegacy
}

// List overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", options.ResourceVersion, "kind", options.Kind)
	ctx = klog.NewContext(ctx, log)
	var method = "list"

	startLegacy := time.Now()
	res, errLegacy := d.Legacy.List(ctx, options)
	if errLegacy != nil {
		log.Error(errLegacy, "unable to list object in legacy storage")
	}
	d.recordLegacyDuration(errLegacy != nil, mode1Str, options.Kind, method, startLegacy)

	go func() {
		startStorage := time.Now()
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("storage list timeout"))
		defer cancel()
		_, err := d.Storage.List(ctx, options)
		d.recordStorageDuration(err != nil, mode1Str, options.Kind, method, startStorage)
	}()

	return res, errLegacy
}

func (d *DualWriterMode1) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	log := d.Log.WithValues("name", name, "kind", options.Kind)
	ctx = klog.NewContext(ctx, d.Log)
	var method = "delete"

	startLegacy := time.Now()
	res, async, err := d.Legacy.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		log.Error(err, "unable to delete object in legacy storage")
		d.recordLegacyDuration(true, mode1Str, options.Kind, method, startLegacy)
		return res, async, err
	}
	d.recordLegacyDuration(false, mode1Str, name, method, startLegacy)

	go func() {
		startStorage := time.Now()
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("storage delete timeout"))
		defer cancel()
		_, _, err := d.Storage.Delete(ctx, name, deleteValidation, options)
		d.recordStorageDuration(err != nil, mode1Str, options.Kind, method, startStorage)
	}()

	return res, async, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes only from LegacyStorage.
func (d *DualWriterMode1) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", listOptions.ResourceVersion)
	ctx = klog.NewContext(ctx, log)
	var method = "delete-collection"

	startLegacy := time.Now()
	res, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.Error(err, "unable to delete collection in legacy storage")
		d.recordLegacyDuration(true, mode1Str, options.Kind, method, startLegacy)
		return res, err
	}
	d.recordLegacyDuration(false, mode1Str, options.Kind, method, startLegacy)

	go func() {
		startStorage := time.Now()
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("storage deletecollection timeout"))
		defer cancel()
		_, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
		d.recordStorageDuration(err != nil, mode1Str, options.Kind, method, startStorage)
	}()

	return res, err
}

func (d *DualWriterMode1) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	log := d.Log.WithValues("name", name, "kind", options.Kind)
	ctx = klog.NewContext(ctx, log)
	var method = "update"

	startLegacy := time.Now()
	res, async, err := d.Legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.Error(err, "unable to update in legacy storage")
		d.recordLegacyDuration(true, mode1Str, options.Kind, method, startLegacy)
		return res, async, err
	}
	d.recordLegacyDuration(false, mode1Str, options.Kind, method, startLegacy)

	go func() {
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("storage update timeout"))

		resCopy := res.DeepCopyObject()
		// get the object to be updated
		foundObj, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			if !apierrors.IsNotFound(err) {
				log.WithValues("object", foundObj).Error(err, "could not get object to update")
				cancel()
			}
			log.Info("object not found for update, creating one")
		}

		updated, err := objInfo.UpdatedObject(ctx, resCopy)
		if err != nil {
			log.WithValues("object", updated).Error(err, "could not update or create object")
			cancel()
		}

		// if the object is found, create a new updateWrapper with the object found
		if foundObj != nil {
			if err := enrichLegacyObject(foundObj, resCopy); err != nil {
				log.Error(err, "could not enrich object")
				cancel()
			}
			objInfo = &updateWrapper{
				upstream: objInfo,
				updated:  resCopy,
			}
		}
		startStorage := time.Now()
		defer cancel()
		_, _, errObjectSt := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
		d.recordStorageDuration(errObjectSt != nil, mode1Str, options.Kind, method, startStorage)
	}()

	return res, async, err
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

func (d *DualWriterMode1) Sync(ctx context.Context) error {
	return nil
}

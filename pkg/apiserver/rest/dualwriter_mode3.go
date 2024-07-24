package rest

import (
	"context"
	"errors"
	"time"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode3 struct {
	Legacy  LegacyStorage
	Storage Storage
	*dualWriterMetrics
	Log klog.Logger
}

// newDualWriterMode3 returns a new DualWriter in mode 3.
// Mode 3 represents writing to LegacyStorage and Storage and reading from Storage.
func newDualWriterMode3(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics) *DualWriterMode3 {
	return &DualWriterMode3{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode3").WithValues("mode", mode3Str), dualWriterMetrics: dwm}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode3) Mode() DualWriterMode {
	return Mode3
}

const mode3Str = "3"

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode3) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	var method = "create"
	log := d.Log.WithValues("kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	created, err := d.Storage.Create(ctx, obj, createValidation, options)
	if err != nil {
		log.Error(err, "unable to create object in storage")
		d.recordLegacyDuration(true, mode3Str, options.Kind, method, startStorage)
		return created, err
	}
	d.recordStorageDuration(false, mode3Str, options.Kind, method, startStorage)

	go func() {
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("legacy create timeout"))
		defer cancel()

		startLegacy := time.Now()
		_, errObjectSt := d.Legacy.Create(ctx, obj, createValidation, options)
		d.recordLegacyDuration(errObjectSt != nil, mode3Str, options.Kind, method, startLegacy)
	}()

	return created, err
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from Storage.
func (d *DualWriterMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	var method = "get"
	log := d.Log.WithValues("kind", options.Kind, "name", name, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	res, err := d.Storage.Get(ctx, name, options)
	if err != nil {
		log.Error(err, "unable to get object in storage")
	}
	d.recordStorageDuration(err != nil, mode3Str, options.Kind, method, startStorage)

	return res, err
}

// List overrides the behavior of the generic DualWriter and reads only from Unified Store.
func (d *DualWriterMode3) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "list"
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", options.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	res, err := d.Storage.List(ctx, options)
	if err != nil {
		log.Error(err, "unable to list object in storage")
	}
	d.recordStorageDuration(err != nil, mode3Str, options.Kind, method, startStorage)

	return res, err
}

func (d *DualWriterMode3) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	var method = "delete"
	log := d.Log.WithValues("name", name, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, d.Log)

	startStorage := time.Now()
	res, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		log.Error(err, "unable to delete object in storage")
		d.recordStorageDuration(true, mode3Str, options.Kind, method, startStorage)
		return res, async, err
	}
	d.recordStorageDuration(false, mode3Str, name, method, startStorage)

	go func() {
		startLegacy := time.Now()
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("legacy delete timeout"))
		defer cancel()
		_, _, err := d.Legacy.Delete(ctx, name, deleteValidation, options)
		d.recordLegacyDuration(err != nil, mode3Str, options.Kind, method, startLegacy)
	}()

	return res, async, err
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *DualWriterMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	var method = "update"
	log := d.Log.WithValues("name", name, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	res, async, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.Error(err, "unable to update in storage")
		d.recordLegacyDuration(true, mode3Str, options.Kind, method, startStorage)
		return res, async, err
	}
	d.recordStorageDuration(false, mode3Str, options.Kind, method, startStorage)

	go func() {
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("legacy update timeout"))

		startLegacy := time.Now()
		defer cancel()
		_, _, errObjectSt := d.Legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
		d.recordLegacyDuration(errObjectSt != nil, mode3Str, options.Kind, method, startLegacy)
	}()

	return res, async, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *DualWriterMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "delete-collection"
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", listOptions.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	res, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.Error(err, "unable to delete collection in storage")
		d.recordStorageDuration(true, mode3Str, options.Kind, method, startStorage)
		return res, err
	}
	d.recordStorageDuration(false, mode3Str, options.Kind, method, startStorage)

	go func() {
		startLegacy := time.Now()
		ctx, cancel := context.WithTimeoutCause(ctx, time.Second*10, errors.New("legacy deletecollection timeout"))
		defer cancel()
		_, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
		d.recordStorageDuration(err != nil, mode3Str, options.Kind, method, startLegacy)
	}()

	return res, err
}

//TODO: uncomment when storage watch is implemented
// func (d *DualWriterMode3) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
// 	var method = "watch"
// 	d.Log.WithValues("kind", options.Kind, "method", method, "mode", mode3Str).Info("starting to watch")
// 	return d.Storage.Watch(ctx, options)
// }

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

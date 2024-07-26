package rest

import (
	"context"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode4 struct {
	Legacy  LegacyStorage
	Storage Storage
	*dualWriterMetrics
	Log klog.Logger
}

const mode4Str = "4"

// newDualWriterMode4 returns a new DualWriter in mode 4.
// Mode 4 represents writing and reading from Storage.
func newDualWriterMode4(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics) *DualWriterMode4 {
	return &DualWriterMode4{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode4").WithValues("mode", mode4Str), dualWriterMetrics: dwm}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode4) Mode() DualWriterMode {
	return Mode4
}

// #TODO remove all DualWriterMode4 methods once we remove the generic DualWriter implementation

// Create overrides the behavior of the generic DualWriter and writes only to Storage.
func (d *DualWriterMode4) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	var method = "create"
	log := d.Log.WithValues("kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)
	res, err := d.Storage.Create(ctx, obj, createValidation, options)
	if err != nil {
		log.Error(err, "unable to create object in storage")
	}
	return res, err
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from Storage.
func (d *DualWriterMode4) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	var method = "get"
	log := d.Log.WithValues("kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)
	res, err := d.Storage.Get(ctx, name, options)
	if err != nil {
		log.Error(err, "unable to create object in storage")
	}
	return res, err
}

func (d *DualWriterMode4) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	var method = "delete"
	log := d.Log.WithValues("name", name, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)
	res, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		log.Error(err, "unable to delete object in storage")
	}
	return res, async, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes only from Storage.
func (d *DualWriterMode4) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "delete-collection"
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", listOptions.ResourceVersion, "method", method, "mode", mode4Str)
	ctx = klog.NewContext(ctx, log)
	res, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.Error(err, "unable to delete collection in storage")
	}
	return res, err
}

// Update overrides the generic behavior of the Storage and writes only to US.
func (d *DualWriterMode4) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	var method = "update"
	log := d.Log.WithValues("name", name, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)
	res, async, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.Error(err, "unable to update object in storage")
	}
	return res, async, err
}

func (d *DualWriterMode4) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "list"
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", options.ResourceVersion, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)
	res, err := d.Storage.List(ctx, options)
	if err != nil {
		log.Error(err, "unable to list objects in storage")
	}
	return res, err
}

//TODO: uncomment when storage watch is implemented
// func (d *DualWriterMode4) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
// 	var method = "watch"
// 	d.Log.WithValues("kind", options.Kind, "method", method, "mode", mode4Str).Info("starting to watch")
// 	return d.Storage.Watch(ctx, options)
// }

func (d *DualWriterMode4) Destroy() {
	d.Storage.Destroy()
}

func (d *DualWriterMode4) GetSingularName() string {
	return d.Storage.GetSingularName()
}

func (d *DualWriterMode4) NamespaceScoped() bool {
	return d.Storage.NamespaceScoped()
}

func (d *DualWriterMode4) New() runtime.Object {
	return d.Storage.New()
}

func (d *DualWriterMode4) NewList() runtime.Object {
	return d.Storage.NewList()
}

func (d *DualWriterMode4) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.Storage.ConvertToTable(ctx, object, tableOptions)
}

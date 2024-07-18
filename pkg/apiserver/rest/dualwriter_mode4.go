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

// newDualWriterMode4 returns a new DualWriter in mode 4.
// Mode 4 represents writing and reading from Storage.
func newDualWriterMode4(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics) *DualWriterMode4 {
	return &DualWriterMode4{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode4"), dualWriterMetrics: dwm}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode4) Mode() DualWriterMode {
	return Mode4
}

// #TODO remove all DualWriterMode4 methods once we remove the generic DualWriter implementation

// Create overrides the behavior of the generic DualWriter and writes only to Storage.
func (d *DualWriterMode4) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return d.Storage.Create(ctx, obj, createValidation, options)
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from Storage.
func (d *DualWriterMode4) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Storage.Get(ctx, name, &metav1.GetOptions{})
}

func (d *DualWriterMode4) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return d.Storage.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes only from Storage.
func (d *DualWriterMode4) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	return d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

// Update overrides the generic behavior of the Storage and writes only to US.
func (d *DualWriterMode4) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func (d *DualWriterMode4) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	return d.Storage.List(ctx, options)
}

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

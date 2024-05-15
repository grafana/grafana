package rest

import (
	"context"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

type DualWriterMode1 struct {
	Legacy  LegacyStorage
	Storage Storage
	Log     klog.Logger
	*dualWriterMetrics
}

// NewDualWriterMode1 returns a new DualWriter in mode 1.
// Mode 1 represents writing to and reading from LegacyStorage.
func NewDualWriterMode1(legacy LegacyStorage, storage Storage) *DualWriterMode1 {
	metrics := &dualWriterMetrics{}
	metrics.init()
	return &DualWriterMode1{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode1"), dualWriterMetrics: metrics}
}

// Create overrides the behavior of the generic DualWriter and writes only to LegacyStorage.
func (d *DualWriterMode1) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx = klog.NewContext(ctx, d.Log)
	return d.Legacy.Create(ctx, obj, createValidation, options)
}

// Get overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ctx = klog.NewContext(ctx, d.Log)
	return d.Legacy.Get(ctx, name, options)
}

// List overrides the behavior of the generic DualWriter and reads only from LegacyStorage.
func (d *DualWriterMode1) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	ctx = klog.NewContext(ctx, d.Log)
	return d.Legacy.List(ctx, options)
}

func (d *DualWriterMode1) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	ctx = klog.NewContext(ctx, d.Log)
	return d.Legacy.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes only from LegacyStorage.
func (d *DualWriterMode1) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	ctx = klog.NewContext(ctx, d.Log)
	return d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

func (d *DualWriterMode1) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx = klog.NewContext(ctx, d.Log)
	return d.Legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
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

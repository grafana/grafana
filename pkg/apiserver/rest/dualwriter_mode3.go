package rest

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	return &DualWriterMode3{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode3"), dualWriterMetrics: dwm}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode3) Mode() DualWriterMode {
	return Mode3
}

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode3) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	log := klog.FromContext(ctx)

	created, err := d.Storage.Create(ctx, obj, createValidation, options)
	if err != nil {
		log.Error(err, "unable to create object in storage")
		return created, err
	}

	if _, err := d.Legacy.Create(ctx, obj, createValidation, options); err != nil {
		log.WithValues("object", created).Error(err, "unable to create object in legacy storage")
	}
	return created, nil
}

// Get overrides the behavior of the generic DualWriter and retrieves an object from Storage.
func (d *DualWriterMode3) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return d.Storage.Get(ctx, name, &metav1.GetOptions{})
}

func (d *DualWriterMode3) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	log := d.Log.WithValues("name", name)
	ctx = klog.NewContext(ctx, log)

	deleted, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.Error(err, "could not delete from unified store")
			return deleted, async, err
		}
	}

	_, _, errLS := d.Legacy.Delete(ctx, name, deleteValidation, options)
	if errLS != nil {
		if !apierrors.IsNotFound(errLS) {
			log.WithValues("deleted", deleted).Error(errLS, "could not delete from legacy store")
		}
	}

	return deleted, async, err
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *DualWriterMode3) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	log := d.Log.WithValues("name", name)
	ctx = klog.NewContext(ctx, log)
	old, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		log.WithValues("object", old).Error(err, "could not get object to update")
		return nil, false, err
	}

	updated, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		log.WithValues("object", updated).Error(err, "could not update or create object")
		return nil, false, err
	}
	objInfo = &updateWrapper{
		upstream: objInfo,
		updated:  updated,
	}

	obj, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.WithValues("object", obj).Error(err, "could not write to US")
		return obj, created, err
	}

	_, _, errLeg := d.Legacy.Update(ctx, name, &updateWrapper{
		upstream: objInfo,
		updated:  obj,
	}, createValidation, updateValidation, forceAllowCreate, options)
	if errLeg != nil {
		log.Error(errLeg, "could not update object in legacy store")
	}
	return obj, created, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *DualWriterMode3) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", listOptions.ResourceVersion)
	ctx = klog.NewContext(ctx, log)

	deleted, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.Error(err, "failed to delete collection successfully from Storage")
	}

	if deleted, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions); err != nil {
		log.WithValues("deleted", deleted).Error(err, "failed to delete collection successfully from LegacyStorage")
	}

	return deleted, err
}

func (d *DualWriterMode3) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	//TODO: implement List
	klog.Error("List not implemented")
	return nil, nil
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

func (d *DualWriterMode3) Sync(ctx context.Context) error {
	return nil
}

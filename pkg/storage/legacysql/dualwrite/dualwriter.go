package dualwrite

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var (
	_ grafanarest.Storage = (*dualWriter)(nil)
)

// dualWriter will write first to legacy, then to unified keeping the same internal ID
type dualWriter struct {
	legacy      grafanarest.Storage
	unified     grafanarest.Storage
	readUnified bool
	errorIsOK   bool // in "mode1" we try writing both -- but don't block on unified write errors
	log         logging.Logger
}

func (d *dualWriter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// Call get (send read traffic in cloud)
	unifiedGet, unifiedErr := d.unified.Get(ctx, name, options)
	if d.readUnified {
		return unifiedGet, unifiedErr
	}

	legacyGet, err := d.legacy.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}

	if unifiedErr != nil && !apierrors.IsNotFound(unifiedErr) && !d.errorIsOK {
		return nil, unifiedErr // the unified error
	}
	return legacyGet, nil
}

func (d *dualWriter) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	// Call list (send read traffic in cloud)
	unifiedList, err := d.unified.List(ctx, options)
	if d.readUnified {
		return unifiedList, err
	}

	if err != nil && !d.errorIsOK {
		return nil, err
	}

	return d.legacy.List(ctx, options)
}

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *dualWriter) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	log := d.log.With("method", "Create").WithContext(ctx)

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
	createdFromLegacy, err := d.legacy.Create(ctx, in, createValidation, options)
	if err != nil {
		log.Error("unable to create object in legacy storage", "err", err)
		return createdFromLegacy, err
	}

	createdCopy := createdFromLegacy.DeepCopyObject()
	accCreated, err := meta.Accessor(createdCopy)
	if err != nil {
		return createdFromLegacy, err
	}
	accCreated.SetResourceVersion("")
	accCreated.SetUID("")

	storageObj, errObjectSt := d.unified.Create(ctx, createdCopy, createValidation, options)
	if errObjectSt != nil {
		log.Error("unable to create object in unified storage", "err", err)
		if d.errorIsOK {
			return createdFromLegacy, nil
		}

		// if we cannot create in unistore, attempt to clean up legacy
		_, _, err = d.legacy.Delete(ctx, accCreated.GetName(), nil, &metav1.DeleteOptions{})
		if err != nil {
			log.Error("unable to cleanup object in legacy storage", "err", err)
		}
	}

	if d.readUnified {
		return storageObj, errObjectSt
	}
	return createdFromLegacy, errObjectSt
}

func (d *dualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// delete from legacy first, and then unistore. Will return a failure if either fails,
	// unless its a 404.
	//
	// we want to delete from legacy first, otherwise if the delete from unistore was successful,
	// but legacy failed, the user would get a failure, but not be able to retry the delete
	// as they would not be able to see the object in unistore anymore.
	objFromLegacy, asyncLegacy, err := d.legacy.Delete(ctx, name, deleteValidation, options)
	if err != nil && !d.readUnified {
		return objFromLegacy, asyncLegacy, err
	}

	objFromStorage, asyncStorage, err := d.unified.Delete(ctx, name, deleteValidation, options)
	if err != nil && apierrors.IsNotFound(err) || d.errorIsOK {
		err = nil // clear the error
	}

	if d.readUnified {
		return objFromStorage, asyncStorage, err
	}

	return objFromLegacy, asyncLegacy, err
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *dualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	log := d.log.With("method", "Update").WithContext(ctx)

	// The incoming RV is not stable -- it may be from legacy or storage!
	// This sets a flag in the context and our apistore is more lenient when it exists
	ctx = grafanarest.WithDualWriteUpdate(ctx)

	// update in legacy first, and then unistore. Will return a failure if either fails.
	//
	// we want to update in legacy first, otherwise if the update from unistore was successful,
	// but legacy failed, the user would get a failure, but see the update did apply to the source
	// of truth, and be less likely to retry to save (and get the stores in sync again)

	objFromLegacy, createdLegacy, err := d.legacy.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.With("object", objFromLegacy).Error("could not update in legacy storage", "err", err)
		return objFromLegacy, createdLegacy, err
	}

	objFromStorage, created, err := d.unified.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.With("object", objFromStorage).Error("could not update in storage", "err", err)
		if d.errorIsOK {
			return objFromLegacy, createdLegacy, nil
		}
	}

	if d.readUnified {
		return objFromStorage, created, err
	}

	return objFromLegacy, createdLegacy, err
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *dualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	log := d.log.With("method", "DeleteCollection", "resourceVersion", listOptions.ResourceVersion).WithContext(ctx)

	// delete from legacy first, and anything that is successful can be deleted in unistore too.
	//
	// we want to delete from legacy first, otherwise if the delete from unistore was successful,
	// but legacy failed, the user would get a failure, but not be able to retry the delete
	// as they would not be able to see the object in unistore anymore.

	deletedLegacy, err := d.legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.With("deleted", deletedLegacy).Error("failed to delete collection successfully from legacy storage", "err", err)
		return deletedLegacy, err
	}

	deletedStorage, err := d.unified.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.With("deleted", deletedStorage).Error("failed to delete collection successfully from Storage", "err", err)
		if d.errorIsOK {
			return deletedLegacy, nil
		}
	}

	if d.readUnified {
		return deletedStorage, err
	}

	return deletedLegacy, err
}

func (d *dualWriter) Destroy() {
	d.legacy.Destroy()
	d.unified.Destroy()
}

func (d *dualWriter) GetSingularName() string {
	return d.unified.GetSingularName()
}

func (d *dualWriter) NamespaceScoped() bool {
	return d.unified.NamespaceScoped()
}

func (d *dualWriter) New() runtime.Object {
	return d.unified.New()
}

func (d *dualWriter) NewList() runtime.Object {
	return d.unified.NewList()
}

func (d *dualWriter) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.unified.ConvertToTable(ctx, object, tableOptions)
}

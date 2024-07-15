package rest

import (
	"context"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type DualWriterMode2 struct {
	Storage Storage
	Legacy  LegacyStorage
	*dualWriterMetrics
	Log klog.Logger
}

const mode2Str = "2"

// NewDualWriterMode2 returns a new DualWriter in mode 2.
// Mode 2 represents writing to LegacyStorage and Storage and reading from LegacyStorage.
func newDualWriterMode2(legacy LegacyStorage, storage Storage, dwm *dualWriterMetrics) *DualWriterMode2 {
	return &DualWriterMode2{Legacy: legacy, Storage: storage, Log: klog.NewKlogr().WithName("DualWriterMode2"), dualWriterMetrics: dwm}
}

// Mode returns the mode of the dual writer.
func (d *DualWriterMode2) Mode() DualWriterMode {
	return Mode2
}

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *DualWriterMode2) Create(ctx context.Context, original runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	var method = "create"
	log := d.Log.WithValues("kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	created, err := d.Legacy.Create(ctx, original, createValidation, options)
	if err != nil {
		log.Error(err, "unable to create object in legacy storage")
		d.recordLegacyDuration(true, mode2Str, options.Kind, method, startLegacy)
		return created, err
	}
	d.recordLegacyDuration(false, mode2Str, options.Kind, method, startLegacy)

	if err := enrichLegacyObject(original, created); err != nil {
		return created, err
	}

	startStorage := time.Now()
	rsp, err := d.Storage.Create(ctx, created, createValidation, options)
	if err != nil {
		log.WithValues("name").Error(err, "unable to create object in storage")
		d.recordStorageDuration(true, mode2Str, options.Kind, method, startStorage)
		return rsp, err
	}
	d.recordStorageDuration(false, mode2Str, options.Kind, method, startStorage)

	areEqual := Compare(rsp, created)
	d.recordOutcome(mode2Str, getName(rsp), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}
	return rsp, err
}

// It retrieves an object from Storage if possible, and if not it falls back to LegacyStorage.
func (d *DualWriterMode2) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	var method = "get"
	log := d.Log.WithValues("name", name, "resourceVersion", options.ResourceVersion, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	startStorage := time.Now()
	objStorage, err := d.Storage.Get(ctx, name, options)
	d.recordStorageDuration(err != nil, mode2Str, options.Kind, method, startStorage)
	if err != nil {
		// if it errors because it's not found, we try to fetch it from the legacy storage
		if !apierrors.IsNotFound(err) {
			log.Error(err, "unable to fetch object from storage")
			return objStorage, err
		}
		log.Info("object not found in storage, fetching from legacy")
	}

	startLegacy := time.Now()
	objLegacy, err := d.Legacy.Get(ctx, name, options)
	if err != nil {
		log.Error(err, "unable to fetch object from legacy")
		d.recordLegacyDuration(true, mode2Str, options.Kind, method, startLegacy)
		return objLegacy, err
	}
	d.recordLegacyDuration(false, mode2Str, options.Kind, method, startLegacy)

	areEqual := Compare(objStorage, objLegacy)
	d.recordOutcome(mode2Str, name, areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	// if there is no object in storage, we return the object from legacy
	if objStorage == nil {
		return objLegacy, nil
	}
	return objStorage, err
}

// List overrides the behavior of the generic DualWriter.
// It returns Storage entries if possible and falls back to LegacyStorage entries if not.
func (d *DualWriterMode2) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "list"
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", options.ResourceVersion, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	ll, err := d.Legacy.List(ctx, options)
	if err != nil {
		log.Error(err, "unable to list objects from legacy storage")
		d.recordLegacyDuration(true, mode2Str, options.Kind, method, startLegacy)
		return ll, err
	}
	d.recordLegacyDuration(false, mode2Str, options.Kind, method, startLegacy)

	legacyList, err := meta.ExtractList(ll)
	if err != nil {
		log.Error(err, "unable to extract list from legacy storage")
		return nil, err
	}

	// Record the index of each LegacyStorage object so it can later be replaced by
	// an equivalent Storage object if it exists.
	optionsStorage, indexMap, err := parseList(legacyList)
	if err != nil {
		return nil, err
	}

	if optionsStorage.LabelSelector == nil {
		return ll, nil
	}

	startStorage := time.Now()
	sl, err := d.Storage.List(ctx, &optionsStorage)
	if err != nil {
		log.Error(err, "unable to list objects from storage")
		d.recordStorageDuration(true, mode2Str, options.Kind, method, startStorage)
		return sl, err
	}
	d.recordStorageDuration(false, mode2Str, options.Kind, method, startStorage)

	storageList, err := meta.ExtractList(sl)
	if err != nil {
		log.Error(err, "unable to extract list from storage")
		return nil, err
	}

	for _, obj := range storageList {
		accessor, err := meta.Accessor(obj)
		if err != nil {
			return nil, err
		}
		name := accessor.GetName()
		if legacyIndex, ok := indexMap[name]; ok {
			legacyList[legacyIndex] = obj
			areEqual := Compare(obj, legacyList[legacyIndex])
			d.recordOutcome(mode2Str, name, areEqual, method)
			if !areEqual {
				log.WithValues("name", name).Info("object from legacy and storage are not equal")
			}
		}
	}

	if err = meta.SetList(ll, legacyList); err != nil {
		return nil, err
	}

	// if the number of items in the legacy list and the storage list are the same, we can return the storage list
	if len(storageList) == len(legacyList) {
		return sl, nil
	}
	log.Info("lists from legacy and storage are not the same size")
	return ll, nil
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *DualWriterMode2) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	var method = "delete-collection"
	log := d.Log.WithValues("kind", options.Kind, "resourceVersion", listOptions.ResourceVersion, "method", method)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	deleted, err := d.Legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.WithValues("deleted", deleted).Error(err, "failed to delete collection successfully from legacy storage")
		d.recordLegacyDuration(true, mode2Str, options.Kind, method, startLegacy)
		return deleted, err
	}
	d.recordLegacyDuration(false, mode2Str, options.Kind, method, startLegacy)

	legacyList, err := meta.ExtractList(deleted)
	if err != nil {
		log.Error(err, "unable to extract list from legacy storage")
		return nil, err
	}

	// Only the items deleted by the legacy DeleteCollection call are selected for deletion by Storage.
	optionsStorage, _, err := parseList(legacyList)
	if err != nil {
		return nil, err
	}
	if optionsStorage.LabelSelector == nil {
		return deleted, nil
	}

	startStorage := time.Now()
	res, err := d.Storage.DeleteCollection(ctx, deleteValidation, options, &optionsStorage)
	if err != nil {
		log.WithValues("deleted", res).Error(err, "failed to delete collection successfully from Storage")
		d.recordStorageDuration(true, mode2Str, options.Kind, method, startStorage)
		return res, err
	}
	d.recordStorageDuration(false, mode2Str, options.Kind, method, startStorage)

	areEqual := Compare(res, deleted)
	d.recordOutcome(mode2Str, getName(res), areEqual, method)
	if !areEqual {
		log.Info("object from legacy and storage are not equal")
	}

	return res, err
}

func (d *DualWriterMode2) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	var method = "delete"
	log := d.Log.WithValues("name", name, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	startLegacy := time.Now()
	deletedLS, async, err := d.Legacy.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.WithValues("objectList", deletedLS).Error(err, "could not delete from legacy store")
			d.recordLegacyDuration(true, mode2Str, options.Kind, method, startLegacy)
			return deletedLS, async, err
		}
	}
	d.recordLegacyDuration(false, mode2Str, options.Kind, method, startLegacy)

	startStorage := time.Now()
	deletedS, _, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.WithValues("objectList", deletedS).Error(err, "could not delete from duplicate storage")
			d.recordStorageDuration(true, mode2Str, options.Kind, method, startStorage)
		}
		return deletedS, async, err
	}
	d.recordStorageDuration(false, mode2Str, options.Kind, method, startStorage)

	areEqual := Compare(deletedS, deletedLS)
	d.recordOutcome(mode2Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}

	return deletedS, async, err
}

// Update overrides the generic behavior of the Storage and writes first to the legacy storage and then to storage.
func (d *DualWriterMode2) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	var method = "update"
	log := d.Log.WithValues("name", name, "kind", options.Kind, "method", method)
	ctx = klog.NewContext(ctx, log)

	// get foundObj and (updated) object so they can be stored in legacy store
	foundObj, err := d.Storage.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		if !apierrors.IsNotFound(err) {
			log.WithValues("object", foundObj).Error(err, "could not get object to update")
			return nil, false, err
		}
		log.Info("object not found for update, creating one")
	}

	// obj can be populated in case it's found or empty in case it's not found
	updated, err := objInfo.UpdatedObject(ctx, foundObj)
	if err != nil {
		log.WithValues("object", updated).Error(err, "could not update or create object")
		return nil, false, err
	}

	startLegacy := time.Now()
	obj, created, err := d.Legacy.Update(ctx, name, &updateWrapper{upstream: objInfo, updated: updated}, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.WithValues("object", obj).Error(err, "could not update in legacy storage")
		d.recordLegacyDuration(true, mode2Str, options.Kind, "update", startLegacy)
		return obj, created, err
	}
	d.recordLegacyDuration(false, mode2Str, options.Kind, "update", startLegacy)

	// if the object is found, create a new updateWrapper with the object found
	if foundObj != nil {
		err = enrichLegacyObject(foundObj, obj)
		if err != nil {
			return obj, false, err
		}

		objInfo = &updateWrapper{
			upstream: objInfo,
			updated:  obj,
		}
	}

	startStorage := time.Now()
	res, created, err := d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		log.WithValues("object", res).Error(err, "could not update in storage")
		d.recordStorageDuration(true, mode2Str, options.Kind, "update", startStorage)
		return res, created, err
	}

	areEqual := Compare(res, obj)
	d.recordOutcome(mode2Str, name, areEqual, method)
	if !areEqual {
		log.WithValues("name", name).Info("object from legacy and storage are not equal")
	}
	return res, created, err
}

func (d *DualWriterMode2) Destroy() {
	d.Storage.Destroy()
	d.Legacy.Destroy()
}

func (d *DualWriterMode2) GetSingularName() string {
	return d.Storage.GetSingularName()
}

func (d *DualWriterMode2) NamespaceScoped() bool {
	return d.Storage.NamespaceScoped()
}

func (d *DualWriterMode2) New() runtime.Object {
	return d.Storage.New()
}

func (d *DualWriterMode2) NewList() runtime.Object {
	return d.Storage.NewList()
}

func (d *DualWriterMode2) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return d.Storage.ConvertToTable(ctx, object, tableOptions)
}

func parseList(legacyList []runtime.Object) (metainternalversion.ListOptions, map[string]int, error) {
	options := metainternalversion.ListOptions{}
	originKeys := []string{}
	indexMap := map[string]int{}

	for i, obj := range legacyList {
		accessor, err := utils.MetaAccessor(obj)
		if err != nil {
			return options, nil, err
		}
		indexMap[accessor.GetName()] = i
	}
	if len(originKeys) == 0 {
		return options, nil, nil
	}
	return options, indexMap, nil
}

func enrichLegacyObject(originalObj, returnedObj runtime.Object) error {
	accessorReturned, err := meta.Accessor(returnedObj)
	if err != nil {
		return err
	}

	accessorOriginal, err := meta.Accessor(originalObj)
	if err != nil {
		return err
	}

	accessorReturned.SetLabels(accessorOriginal.GetLabels())

	ac := accessorReturned.GetAnnotations()
	if ac == nil {
		ac = map[string]string{}
	}
	for k, v := range accessorOriginal.GetAnnotations() {
		ac[k] = v
	}
	accessorReturned.SetAnnotations(ac)

	accessorReturned.SetResourceVersion(accessorOriginal.GetResourceVersion())
	accessorReturned.SetUID(accessorOriginal.GetUID())
	return nil
}

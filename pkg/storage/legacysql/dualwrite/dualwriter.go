package dualwrite

import (
	"context"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var (
	_ grafanarest.Storage = (*dualWriter)(nil)
)

// Let's give the background queries a bit more time to complete
// as we also run them as part of load tests that might need longer
// to complete. Those run in the background and won't impact the
// user experience in any way.
const backgroundReqTimeout = time.Minute

// dualWriter will write first to legacy, then to unified keeping the same internal ID
type dualWriter struct {
	legacy      grafanarest.Storage
	unified     grafanarest.Storage
	readUnified bool
	errorIsOK   bool // in "mode1" we try writing both -- but don't block on unified write errors
}

func (d *dualWriter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	log := logging.FromContext(ctx).With("method", "Get", "name", name)
	// If we read from unified, we can just do that and return.
	if d.readUnified {
		return d.unified.Get(ctx, name, options)
	}
	// If legacy is still our main store, lets first read from it.
	legacyGet, err := d.legacy.Get(ctx, name, options)
	if err != nil {
		log.Error("failed to get object from legacy storage", "err", err)
		return nil, err
	}
	// Once we have successfully read from legacy, we can check if we want to fail on a unified read.
	// If we allow the unified read to fail, we can do it in the background.
	if d.errorIsOK {
		go func(ctxBg context.Context, cancel context.CancelFunc) {
			defer cancel()
			if _, err := d.unified.Get(ctxBg, name, options); err != nil {
				log.Error("failed background GET to unified", "err", err)
			}
		}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
		return legacyGet, nil
	}
	// If it's not okay to fail, we have to check it in the foreground.
	_, unifiedErr := d.unified.Get(ctx, name, options)
	if unifiedErr != nil && !apierrors.IsNotFound(unifiedErr) {
		log.Error("failed to get object from unified storage", "err", unifiedErr)
		return nil, unifiedErr
	}
	return legacyGet, nil
}

func (d *dualWriter) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	// Always work on *copies* so we never mutate the caller's ListOptions.
	var (
		legacyOptions  = options.DeepCopy()
		unifiedOptions = options.DeepCopy()
		log            = logging.FromContext(ctx).With("method", "List", "options", options)
	)

	legacyToken, unifiedToken, err := parseContinueTokens(options.Continue)
	if err != nil {
		return nil, err
	}

	legacyOptions.Continue = legacyToken
	unifiedOptions.Continue = unifiedToken

	// If we read from unified, we can just do that and return.
	if d.readUnified {
		unifiedList, err := d.unified.List(ctx, unifiedOptions)
		if err != nil {
			log.Error("failed to list objects from unified storage", "err", err)
			return nil, err
		}
		unifiedMeta, err := meta.ListAccessor(unifiedList)
		if err != nil {
			return nil, fmt.Errorf("failed to access legacy List MetaData: %w", err)
		}
		unifiedMeta.SetContinue(buildContinueToken("", unifiedMeta.GetContinue()))
		return unifiedList, nil
	}

	// In some cases, the unified token might be there but legacy token is empty (i.e. finished iteration).
	// This can happen, as unified storage iteration is doing paging not only based on the provided limit,
	// but also based on the response size. This check prevents starting the new iteration again.
	if options.Continue != "" && legacyToken == "" {
		return d.NewList(), nil
	}

	// In some cases, where the stores are not in sync yet, the unified storage continue token might already
	// be empty, while the legacy one is not, as it has more data. In that case we don't want to issue a new
	// request with an empty continue token, resulting in getting the first page again.
	// nolint:staticcheck
	shouldDoUnifiedRequest := true
	if options.Continue != "" && unifiedToken == "" {
		shouldDoUnifiedRequest = false
	}

	// If legacy is still the main store, lets first read from it.
	legacyList, err := d.legacy.List(ctx, legacyOptions)
	if err != nil {
		log.Error("failed to list objects from legacy storage", "err", err)
		return nil, err
	}
	legacyMeta, err := meta.ListAccessor(legacyList)
	if err != nil {
		return nil, fmt.Errorf("failed to access legacy List MetaData: %w", err)
	}
	legacyToken = legacyMeta.GetContinue()

	// Once we have successfully listed from legacy, we can check if we want to fail on a unified list.
	// If we allow the unified list to fail, we can do it in the background and return.
	if d.errorIsOK && shouldDoUnifiedRequest {
		// We would like to get continue token from unified storage, but
		// don't want to wait for unified storage too long, since we're calling
		// unified-storage asynchronously.
		out := make(chan string, 1)
		go func(ctxBg context.Context, cancel context.CancelFunc) {
			defer cancel()
			defer close(out)
			unifiedList, err := d.unified.List(ctxBg, unifiedOptions)
			if err != nil {
				log.Error("failed background LIST to unified", "err", err)
				return
			}
			unifiedMeta, err := meta.ListAccessor(unifiedList)
			if err != nil {
				log.Error("failed background LIST to unified", "err",
					fmt.Errorf("failed to access unified List MetaData: %w", err))
			}
			out <- unifiedMeta.GetContinue()
		}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
		select {
		case unifiedToken = <-out:
		case <-time.After(300 * time.Millisecond):
			log.Warn("timeout while waiting on the unified storage continue token")
			break
		}
		legacyMeta.SetContinue(buildContinueToken(legacyToken, unifiedToken))
		return legacyList, nil
	}
	if shouldDoUnifiedRequest {
		// If it's not okay to fail, we have to check it in the foreground.
		unifiedList, err := d.unified.List(ctx, unifiedOptions)
		if err != nil {
			log.Error("failed to list objects from unified storage", "err", err)
			return nil, err
		}
		unifiedMeta, err := meta.ListAccessor(unifiedList)
		if err != nil {
			return nil, fmt.Errorf("failed to access unified List MetaData: %w", err)
		}
		unifiedToken = unifiedMeta.GetContinue()
	}
	legacyMeta.SetContinue(buildContinueToken(legacyToken, unifiedToken))
	return legacyList, nil
}

// Create overrides the behavior of the generic DualWriter and writes to LegacyStorage and Storage.
func (d *dualWriter) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	log := logging.FromContext(ctx).With("method", "Create")

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

	readFromUnifiedWriteToBothStorages := d.readUnified && d.legacy != nil && d.unified != nil

	permissions := ""
	if readFromUnifiedWriteToBothStorages {
		objIn, err := utils.MetaAccessor(in)
		if err != nil {
			return nil, err
		}

		// keep permissions, we will set it back after the object is created
		permissions = objIn.GetAnnotation(utils.AnnoKeyGrantPermissions)
		if permissions != "" {
			objIn.SetAnnotation(utils.AnnoKeyGrantPermissions, "") // remove the annotation for now
		}
	}

	// create in legacy first, and then unistore. if unistore fails, but legacy succeeds,
	// will try to cleanup the object in legacy.
	createdFromLegacy, err := d.legacy.Create(ctx, in, createValidation, options)
	if err != nil {
		log.With("object", in).Error("failed to CREATE object in legacy storage", "err", err)
		return nil, err
	}

	createdCopy := createdFromLegacy.DeepCopyObject()
	accCreated, err := meta.Accessor(createdCopy)
	if err != nil {
		return nil, err
	}
	accCreated.SetResourceVersion("")
	accCreated.SetUID("")

	if readFromUnifiedWriteToBothStorages {
		objCopy, err := utils.MetaAccessor(createdCopy)
		if err != nil {
			return nil, err
		}
		// restore the permissions annotation, as we removed it before creating in legacy
		if permissions != "" {
			objCopy.SetAnnotation(utils.AnnoKeyGrantPermissions, permissions)
		}
	}

	// If unified storage is the primary storage, let's just create it in the foreground and return it.
	if d.readUnified {
		storageObj, errObjectSt := d.unified.Create(ctx, createdCopy, createValidation, options)
		if errObjectSt != nil {
			log.With("object", createdCopy).Error("failed to CREATE object in unified storage", "err", errObjectSt)
			// If we cannot create in unified storage, attempt to clean up legacy.
			go func(ctxBg context.Context, cancel context.CancelFunc) {
				defer cancel()
				if _, asyncDelete, err := d.legacy.Delete(ctxBg, accCreated.GetName(), nil, &metav1.DeleteOptions{}); err != nil {
					log.With("name", accCreated.GetName()).Error("failed to CLEANUP object in legacy storage", "err", err, "asyncDelete", asyncDelete)
				}
			}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
			return nil, errObjectSt
		}
		return storageObj, nil
	} else if d.errorIsOK {
		// If we don't use unified as the primary store and errors are okay, let's create it in the background.
		go func(ctxBg context.Context, cancel context.CancelFunc) {
			defer cancel()
			if _, err := d.unified.Create(ctxBg, createdCopy, createValidation, options); err != nil {
				log.With("object", createdCopy).Error("failed to CREATE object in unified storage", "err", err)
			}
		}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
	} else {
		// Otherwise let's create it in the foreground and return any error.
		if _, err := d.unified.Create(ctx, createdCopy, createValidation, options); err != nil {
			log.With("object", createdCopy).Error("failed to CREATE object in unified storage", "err", err)
			if d.errorIsOK {
				return createdFromLegacy, nil
			}
			// If we cannot create in unified storage, attempt to clean up legacy.
			go func(ctxBg context.Context, cancel context.CancelFunc) {
				defer cancel()
				if _, asyncDelete, err := d.legacy.Delete(ctxBg, accCreated.GetName(), nil, &metav1.DeleteOptions{}); err != nil {
					log.With("name", accCreated.GetName()).Error("failed to CLEANUP object in legacy storage", "err", err, "asyncDelete", asyncDelete)
				}
			}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
			return nil, err
		}
	}
	return createdFromLegacy, nil
}

func (d *dualWriter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// delete from legacy first, and then unistore. Will return a failure if either fails,
	// unless its a 404.
	//
	// we want to delete from legacy first, otherwise if the delete from unistore was successful,
	// but legacy failed, the user would get a failure, but not be able to retry the delete
	// as they would not be able to see the object in unistore anymore.

	// By setting RemovePermissions to false in the context, we will skip the deletion of permissions
	// in the legacy store. This is needed as otherwise the permissions would be missing when executing
	// the delete operation in the unified storage store.
	log := logging.FromContext(ctx).With("method", "Delete", "name", name)
	ctx = utils.SetFolderRemovePermissions(ctx, false)

	objFromLegacy, asyncLegacy, err := d.legacy.Delete(ctx, name, deleteValidation, options)
	if err != nil && (!d.readUnified || !d.errorIsOK && !apierrors.IsNotFound(err)) {
		log.Error("failed to DELETE object in legacy storage", "err", err)
		return nil, false, err
	}

	// We can now flip it again.
	ctx = utils.SetFolderRemovePermissions(ctx, true)

	// If unified storage is our primary store, just delete it and return
	if d.readUnified {
		objFromStorage, asyncStorage, err := d.unified.Delete(ctx, name, deleteValidation, options)
		if err != nil && !apierrors.IsNotFound(err) && !d.errorIsOK {
			log.Error("failed to DELETE object in unified storage", "err", err)
			return nil, false, err
		}
		return objFromStorage, asyncStorage, nil
	} else if d.errorIsOK {
		// If errors are okay and unified is not primary, we can just run it as background operation.
		go func(ctxBg context.Context, cancel context.CancelFunc) {
			defer cancel()
			_, _, err := d.unified.Delete(ctxBg, name, deleteValidation, options)
			if err != nil && !apierrors.IsNotFound(err) && !d.errorIsOK {
				log.Error("failed background DELETE in unified storage", "err", err)
			}
		}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
	}
	// Otherwise we just run it in the foreground and return an error if any might happen.
	_, _, err = d.unified.Delete(ctx, name, deleteValidation, options)
	if err != nil && !apierrors.IsNotFound(err) && !d.errorIsOK {
		log.Error("failed to DELETE object in unified storage", "err", err)
		return nil, false, err
	}
	return objFromLegacy, asyncLegacy, nil
}

// Update overrides the behavior of the generic DualWriter and writes first to Storage and then to LegacyStorage.
func (d *dualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	log := logging.FromContext(ctx).With("method", "Update", "name", name, "objInfo", objInfo)

	// update in legacy first, and then unistore. Will return a failure if either fails.
	//
	// we want to update in legacy first, otherwise if the update from unistore was successful,
	// but legacy failed, the user would get a failure, but see the update did apply to the source
	// of truth, and be less likely to retry to save (and get the stores in sync again)

	legacyInfo := objInfo
	legacyForceCreate := forceAllowCreate
	unifiedInfo := objInfo
	unifiedForceCreate := forceAllowCreate
	if d.readUnified {
		legacyInfo = &wrappedUpdateInfo{objInfo: objInfo}
		legacyForceCreate = true
	} else {
		unifiedInfo = &wrappedUpdateInfo{objInfo: objInfo}
		unifiedForceCreate = true
	}

	objFromLegacy, createdLegacy, err := d.legacy.Update(ctx, name, legacyInfo, createValidation, updateValidation, legacyForceCreate, options)
	if err != nil {
		log.Error("failed to UPDATE in legacy storage", "err", err)
		return nil, false, err
	}

	// add any metadata returned from legacy to what is saved in unified storage when forceCreate is used.
	// this is especially needed for legacy internal IDs
	if createdLegacy {
		legacyMeta, err := utils.MetaAccessor(objFromLegacy)
		if err != nil {
			log.Error("failed to get meta accessor for legacy object", "err", err)
			return nil, false, err
		}
		unifiedInfo = &wrappedUpdateInfo{
			objInfo:           objInfo,
			legacyLabels:      legacyMeta.GetLabels(),
			legacyAnnotations: legacyMeta.GetAnnotations(),
		}
	}

	if d.readUnified {
		return d.unified.Update(ctx, name, unifiedInfo, createValidation, updateValidation, unifiedForceCreate, options)
	} else if d.errorIsOK {
		// If unified is not primary, but errors are okay, we can just run in the background.
		go func(ctxBg context.Context, cancel context.CancelFunc) {
			defer cancel()
			if _, _, err := d.unified.Update(ctxBg, name, unifiedInfo, createValidation, updateValidation, unifiedForceCreate, options); err != nil {
				log.Error("failed background UPDATE to unified storage", "err", err)
			}
		}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
		return objFromLegacy, createdLegacy, nil
	}
	// If we want to check unified errors just run it in foreground.
	if _, _, err := d.unified.Update(ctx, name, unifiedInfo, createValidation, updateValidation, unifiedForceCreate, options); err != nil {
		log.Error("failed to UPDATE in unified storage", "err", err)
		return nil, false, err
	}
	return objFromLegacy, createdLegacy, nil
}

// DeleteCollection overrides the behavior of the generic DualWriter and deletes from both LegacyStorage and Storage.
func (d *dualWriter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	log := logging.FromContext(ctx).With("method", "DeleteCollection", "resourceVersion", listOptions.ResourceVersion)

	// delete from legacy first, and anything that is successful can be deleted in unistore too.
	//
	// we want to delete from legacy first, otherwise if the delete from unistore was successful,
	// but legacy failed, the user would get a failure, but not be able to retry the delete
	// as they would not be able to see the object in unistore anymore.

	deletedLegacy, err := d.legacy.DeleteCollection(ctx, deleteValidation, options, listOptions)
	if err != nil {
		log.With("options", options).Error("failed to DELETE collection successfully from legacy storage", "err", err)
		return nil, err
	}

	// If unified is the primary store, we can just delete it there and return.
	if d.readUnified {
		return d.unified.DeleteCollection(ctx, deleteValidation, options, listOptions)
	} else if d.errorIsOK {
		// If unified storage is not the primary store and errors are okay, we can just run it in the background.
		go func(ctxBg context.Context, cancel context.CancelFunc) {
			defer cancel()
			if _, err := d.unified.DeleteCollection(ctxBg, deleteValidation, options, listOptions); err != nil {
				log.With("object", deletedLegacy).Error("failed background DELETE collection to unified storage", "err", err)
			}
		}(context.WithTimeout(context.WithoutCancel(ctx), backgroundReqTimeout))
		return deletedLegacy, nil
	}
	// Otherwise we have to check the error and run it in the foreground.
	if _, err := d.unified.DeleteCollection(ctx, deleteValidation, options, listOptions); err != nil {
		log.With("object", deletedLegacy).Error("failed to DELETE collection successfully from Storage", "err", err)
		return nil, err
	}
	return deletedLegacy, nil
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

type wrappedUpdateInfo struct {
	objInfo           rest.UpdatedObjectInfo
	legacyLabels      map[string]string
	legacyAnnotations map[string]string
}

// Preconditions implements rest.UpdatedObjectInfo.
func (w *wrappedUpdateInfo) Preconditions() *metav1.Preconditions {
	return nil
}

// UpdatedObject implements rest.UpdatedObjectInfo.
func (w *wrappedUpdateInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) {
	obj, err := w.objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	// add any labels or annotations set by legacy storage
	if len(w.legacyLabels) > 0 {
		existingLabels := meta.GetLabels()
		if existingLabels == nil {
			existingLabels = make(map[string]string)
		}
		for key, value := range w.legacyLabels {
			existingLabels[key] = value
		}
		meta.SetLabels(existingLabels)
	}
	if len(w.legacyAnnotations) > 0 {
		existingAnnotations := meta.GetAnnotations()
		if existingAnnotations == nil {
			existingAnnotations = make(map[string]string)
		}
		for key, value := range w.legacyAnnotations {
			existingAnnotations[key] = value
		}
		meta.SetAnnotations(existingAnnotations)
	}

	meta.SetResourceVersion("")
	meta.SetUID("")
	return obj, err
}

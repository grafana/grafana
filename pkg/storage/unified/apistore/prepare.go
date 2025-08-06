package apistore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/google/uuid"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/klog/v2"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type objectForStorage struct {
	// The value to save in unistore
	raw bytes.Buffer

	// Reference to the owner object
	ref common.ObjectReference

	// apply permissions after create (defined in the resource body)
	grantPermissions string

	// Synchronous AfterCreate permissions -- allows users to become "admin" of the thing they made
	permissionCreator permissionCreatorFunc

	// These secrets where created, should be cleaned up if storage fails
	createdSecureValues []string

	// These should be deleted if storage succeeds
	deleteSecureValues []string

	// We know something changed
	// This will ensure that the generation increments
	hasChanged bool
}

func (v *objectForStorage) finish(ctx context.Context, err error, store *Storage) error {
	if err != nil {
		// Remove the secure values that were created
		for _, s := range v.createdSecureValues {
			e := store.opts.SecureValues.DeleteWhenOwnedByResource(ctx, v.ref, s)
			logging.FromContext(ctx).Warn("unable to clean up new secure value", "name", s, "err", e)
		}
		return err
	}

	// Delete secure values after successfully saving the object
	if len(v.deleteSecureValues) > 0 {
		for _, s := range v.deleteSecureValues {
			e := store.opts.SecureValues.DeleteWhenOwnedByResource(ctx, v.ref, s)
			logging.FromContext(ctx).Warn("unable to clean up new secure value", "name", s, "err", e)
		}
	}

	// Create permissions
	if v.permissionCreator != nil {
		return v.permissionCreator(ctx)
	}

	return nil
}

// Called on create
func (s *Storage) prepareObjectForStorage(ctx context.Context, newObject runtime.Object) (objectForStorage, error) {
	v := objectForStorage{}
	info, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return v, errors.New("missing auth info")
	}

	obj, err := utils.MetaAccessor(newObject)
	if err != nil {
		return v, err
	}
	if obj.GetName() == "" {
		return v, storage.NewInvalidObjError("", "missing name")
	}
	if obj.GetResourceVersion() != "" {
		return v, storage.ErrResourceVersionSetOnCreate
	}
	if obj.GetUID() == "" {
		obj.SetUID(types.UID(uuid.NewString()))
	}
	if obj.GetFolder() != "" && !s.opts.EnableFolderSupport {
		return v, apierrors.NewBadRequest(fmt.Sprintf("folders are not supported for: %s", s.gr.String()))
	}

	v.grantPermissions = obj.GetAnnotation(utils.AnnoKeyGrantPermissions)
	if v.grantPermissions != "" {
		obj.SetAnnotation(utils.AnnoKeyGrantPermissions, "") // remove the annotation
	}
	if err := checkManagerPropertiesOnCreate(info, obj); err != nil {
		return v, err
	}

	if s.opts.RequireDeprecatedInternalID {
		// nolint:staticcheck
		id := obj.GetDeprecatedInternalID()
		if id < 1 {
			// the ID must be smaller than 9007199254740991, otherwise we will lose prescision
			// on the frontend, which uses the number type to store ids. The largest safe number in
			// javascript is 9007199254740991, compared to 9223372036854775807 as the max int64
			// nolint:staticcheck
			obj.SetDeprecatedInternalID(s.snowflake.Generate().Int64() & ((1 << 52) - 1))
		}
	}

	obj.SetGenerateName("") // Clear the random name field
	obj.SetResourceVersion("")
	obj.SetSelfLink("")

	obj.SetUpdatedBy("")
	obj.SetUpdatedTimestamp(nil)
	obj.SetCreatedBy(info.GetUID())
	obj.SetGeneration(1) // the first time we write

	err = handleSecureValues(ctx, s.opts.SecureValues, obj, nil, &v)
	if err != nil {
		return v, err
	}

	err = s.codec.Encode(newObject, &v.raw)
	if err == nil {
		err = s.handleLargeResources(ctx, obj, &v.raw)
	}
	return v, err
}

// Called on update
func (s *Storage) prepareObjectForUpdate(ctx context.Context, updateObject runtime.Object, previousObject runtime.Object) (objectForStorage, error) {
	v := objectForStorage{}
	info, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return v, errors.New("missing auth info")
	}

	obj, err := utils.MetaAccessor(updateObject)
	if err != nil {
		return v, err
	}
	if obj.GetName() == "" {
		return v, fmt.Errorf("updated object must have a name")
	}

	previous, err := utils.MetaAccessor(previousObject)
	if err != nil {
		return v, err
	}

	if previous.GetUID() == "" {
		klog.Errorf("object is missing UID: %s, %s", obj.GetGroupVersionKind().String(), obj.GetName())
	} else if obj.GetUID() != previous.GetUID() {
		// Eventually this should be a real error or logged
		// However the dashboard dual write behavior hits this every time, so we will ignore it
		// if obj.GetUID() != "" {
		// 	klog.Errorf("object UID mismatch: %s, was:%s, now: %s", obj.GetGroupVersionKind().String(), previous.GetName(), obj.GetUID())
		// }
		obj.SetUID(previous.GetUID())
	}

	if obj.GetName() != previous.GetName() {
		return v, fmt.Errorf("name mismatch between existing and updated object")
	}

	obj.SetCreatedBy(previous.GetCreatedBy())
	obj.SetCreationTimestamp(previous.GetCreationTimestamp())
	obj.SetResourceVersion("")                           // removed from saved JSON because the RV is not yet calculated
	obj.SetAnnotation(utils.AnnoKeyGrantPermissions, "") // Grant is ignored for update requests

	// for dashboards, a mutation hook will set it if it didn't exist on the previous obj
	// avoid setting it back to 0
	previousInternalID := previous.GetDeprecatedInternalID() // nolint:staticcheck
	if previousInternalID != 0 {
		obj.SetDeprecatedInternalID(previousInternalID) // nolint:staticcheck
	}

	err = handleSecureValues(ctx, s.opts.SecureValues, obj, previous, &v)
	if err != nil {
		return v, err
	}

	// Check if we should bump the generation
	if obj.GetFolder() != previous.GetFolder() {
		if !s.opts.EnableFolderSupport {
			return v, apierrors.NewBadRequest(fmt.Sprintf("folders are not supported for: %s", s.gr.String()))
		}
		// TODO: check that we can move the folder?
		v.hasChanged = true
	} else if obj.GetDeletionTimestamp() != nil && previous.GetDeletionTimestamp() == nil {
		v.hasChanged = true // bump generation when deleted
	} else if !v.hasChanged {
		spec, e1 := obj.GetSpec()
		oldSpec, e2 := previous.GetSpec()
		if e1 == nil && e2 == nil {
			if !apiequality.Semantic.DeepEqual(spec, oldSpec) {
				v.hasChanged = true
			}
		}
	}

	// Mark the resource as changed
	if v.hasChanged {
		obj.SetGeneration(previous.GetGeneration() + 1)
		obj.SetUpdatedBy(info.GetUID())
		obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())

		// Only validate when the generation has changed
		if err := checkManagerPropertiesOnUpdateSpec(info, obj, previous); err != nil {
			return v, err
		}
	} else {
		obj.SetGeneration(previous.GetGeneration())
		obj.SetAnnotation(utils.AnnoKeyUpdatedBy, previous.GetAnnotation(utils.AnnoKeyUpdatedBy))
		obj.SetAnnotation(utils.AnnoKeyUpdatedTimestamp, previous.GetAnnotation(utils.AnnoKeyUpdatedTimestamp))
	}

	err = s.codec.Encode(updateObject, &v.raw)
	if err == nil {
		err = s.handleLargeResources(ctx, obj, &v.raw)
	}
	return v, err
}

// The bytes buffer will be reset with the proper value
func (s *Storage) handleLargeResources(ctx context.Context, obj utils.GrafanaMetaAccessor, buf *bytes.Buffer) error {
	support := s.opts.LargeObjectSupport
	size := buf.Len()
	if support != nil && size > support.Threshold() {
		if support.MaxSize() > 0 && size > support.MaxSize() {
			return fmt.Errorf("request object is too big (%s > %s)", humanize.Bytes(uint64(size)), humanize.Bytes(uint64(support.MaxSize())))
		}

		key := &resourcepb.ResourceKey{
			Group:     s.gr.Group,
			Resource:  s.gr.Resource,
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
		}

		err := support.Deconstruct(ctx, key, s.store, obj, buf.Bytes())
		if err != nil {
			return err
		}

		buf.Reset()
		orig, ok := obj.GetRuntimeObject()
		if !ok {
			return fmt.Errorf("error using object as runtime object")
		}

		// Now encode the smaller version
		return s.codec.Encode(orig, buf)
	}
	return nil
}

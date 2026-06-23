package apistore

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/google/uuid"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/klog/v2"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/folder"
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

func (v *objectForStorage) finish(ctx context.Context, err error, secrets secrets.InlineSecureValueSupport) error {
	if err != nil {
		// Remove the secure values that were created
		for _, s := range v.createdSecureValues {
			if e := secrets.DeleteWhenOwnedByResource(ctx, v.ref, s); e != nil {
				logging.FromContext(ctx).Warn("unable to clean up new secure value", "name", s, "err", e)
			}
		}
		return err
	}

	// Delete secure values after successfully saving the object
	if len(v.deleteSecureValues) > 0 {
		for _, s := range v.deleteSecureValues {
			if e := secrets.DeleteWhenOwnedByResource(ctx, v.ref, s); e != nil {
				logging.FromContext(ctx).Warn("unable to clean up new secure value", "name", s, "err", e)
			}
		}
	}

	// Create permissions
	if v.permissionCreator != nil {
		return v.permissionCreator(ctx)
	}

	return nil
}

// verifyFolder enforces the folder-annotation contract on write.
//
//   - EnableFolderSupport=false: the resource does not live in the folder tree
//     at all; reject any write that sets the folder annotation.
//   - EnableFolderSupport=true and RequireFolder=false: any folder value is
//     accepted (including empty / root).
//   - EnableFolderSupport=true and RequireFolder=true: the folder annotation
//     must be present and non-root; resources of this kind must live in a real
//     folder.
func (s *Storage) verifyFolder(obj utils.GrafanaMetaAccessor) error {
	folderUID := obj.GetFolder()
	if !s.opts.EnableFolderSupport {
		if folderUID == "" {
			return nil
		}
		return apierrors.NewInvalid(
			obj.GetGroupVersionKind().GroupKind(),
			obj.GetName(),
			field.ErrorList{
				field.Forbidden(
					field.NewPath("metadata", "annotations").Key(utils.AnnoKeyFolder),
					fmt.Sprintf("folders are not supported for %s", s.gr.String()),
				),
			},
		)
	}
	if !s.opts.RequireFolder {
		return nil
	}
	if folderUID == "" {
		return apierrors.NewInvalid(
			obj.GetGroupVersionKind().GroupKind(),
			obj.GetName(),
			field.ErrorList{
				field.Required(
					field.NewPath("metadata", "annotations").Key(utils.AnnoKeyFolder),
					fmt.Sprintf("folder is required for %s", s.gr.String()),
				),
			},
		)
	}
	if folder.IsRootFolderUID(folderUID) {
		return apierrors.NewInvalid(
			obj.GetGroupVersionKind().GroupKind(),
			obj.GetName(),
			field.ErrorList{
				field.Forbidden(
					field.NewPath("metadata", "annotations").Key(utils.AnnoKeyFolder),
					fmt.Sprintf("%s cannot be created in the root folder", s.gr.String()),
				),
			},
		)
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
	if err := s.checkGVK(newObject); err != nil {
		return v, err
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
	if err = s.verifyFolder(obj); err != nil {
		return v, err
	}
	if s.opts.MaximumNameLength > 0 && len(obj.GetName()) > s.opts.MaximumNameLength {
		return v, apierrors.NewBadRequest(fmt.Sprintf("name exceeds maximum length (%d)", s.opts.MaximumNameLength))
	}

	v.grantPermissions = obj.GetAnnotation(utils.AnnoKeyGrantPermissions)
	if v.grantPermissions != "" {
		obj.SetAnnotation(utils.AnnoKeyGrantPermissions, "") // remove the annotation
	}
	if err := checkManagerPropertiesOnCreate(info, obj); err != nil {
		return v, err
	}
	if err := s.ensureRepoManagedByParentFolder(ctx, obj); err != nil {
		return v, err
	}

	// Make sure the deprecated internal ID is valid
	id := obj.GetDeprecatedInternalID() // nolint:staticcheck
	// nolint:staticcheck
	switch {
	case id > 0:
		if s.opts.DeprecatedInternalID == DeprecatedID_None {
			return v, apierrors.NewBadRequest("internal ID is not supported")
		}
		if err := s.ensureSingleDeprecatedInternalID(ctx, id, obj); err != nil {
			return v, err
		}
	case s.opts.DeprecatedInternalID == DeprecatedID_Required:
		// the ID must be smaller than 9007199254740991, otherwise we will lose precision
		// on the frontend, which uses the number type to store ids. The largest safe number in
		// javascript is 9007199254740991, compared to 9223372036854775807 as the max int64
		obj.SetDeprecatedInternalID(s.snowflake.Generate().Int64() & ((1 << 52) - 1))
	case s.opts.DeprecatedInternalID == DeprecatedID_None:
		obj.SetDeprecatedInternalID(0) // remove it
	}

	obj.SetGenerateName("") // Clear the random name field
	obj.SetResourceVersion("")
	obj.SetSelfLink("")

	obj.SetUpdatedBy("")
	obj.SetUpdatedTimestamp(nil)
	createdBy := info.GetUID()
	if metaUID, ok := identity.MetadataIdentityUIDFrom(ctx); ok {
		createdBy = metaUID
	}
	obj.SetCreatedBy(createdBy)
	obj.SetGeneration(1) // the first time we write

	err = prepareSecureValues(ctx, s.opts.SecureValues, obj, nil, &v)
	if err != nil {
		return v, err
	}

	err = s.encode(newObject, &v.raw)
	return v, err
}

// ensureSingleDeprecatedInternalID rejects a write when the requested internal
// ID is already in use. This is best effort, not a guarantee: the check queries
// an eventually-consistent search index and is not atomic with the write, so
// concurrent (or rapid sequential, before the index catches up) writes with the
// same ID can both pass. It catches the common accidental-duplicate case, not
// races.
func (s *Storage) ensureSingleDeprecatedInternalID(ctx context.Context, id int64, obj utils.GrafanaMetaAccessor) error {
	if s.opts.Index == nil {
		// The storage was not configured to verify uniqueness
		return nil
	}
	rsp, err := s.opts.Index.Search(ctx, &resourcepb.ResourceSearchRequest{
		Limit: 1, // we only need to know if any match exists
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     s.gr.Group,
				Resource:  s.gr.Resource,
				Namespace: obj.GetNamespace(),
			},
			Labels: []*resourcepb.Requirement{{
				Key:      utils.LabelKeyDeprecatedInternalID,
				Operator: string(selection.Equals),
				Values:   []string{strconv.FormatInt(id, 10)},
			}},
		},
	})
	if err != nil {
		return err
	}
	if rsp.Results != nil && len(rsp.Results.Rows) > 0 {
		return apierrors.NewConflict(s.gr, obj.GetName(),
			fmt.Errorf("deprecatedInternalID=%d is already in use", id))
	}
	return nil
}

// Called on update
func (s *Storage) prepareObjectForUpdate(ctx context.Context, updateObject runtime.Object, previousObject runtime.Object) (objectForStorage, error) {
	v := objectForStorage{}
	info, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return v, errors.New("missing auth info")
	}
	if err := s.checkGVK(updateObject); err != nil {
		return v, err
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

	// Make sure the deprecated internalID does not change
	obj.SetDeprecatedInternalID(previous.GetDeprecatedInternalID()) // nolint:staticcheck

	err = prepareSecureValues(ctx, s.opts.SecureValues, obj, previous, &v)
	if err != nil {
		return v, err
	}

	// Check if we should bump the generation
	if obj.GetFolder() != previous.GetFolder() {
		if err = s.verifyFolder(obj); err != nil {
			return v, err
		}
		if err := s.ensureRepoManagedByParentFolder(ctx, obj); err != nil {
			return v, err
		}
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

	if err := checkManagerPropertiesOnUpdateSpec(info, obj, previous); err != nil {
		return v, err
	}

	// If staying in the same folder but manager properties changed, re-validate
	// consistency with the parent folder. Without this, removing or changing
	// manager annotations would leave unmanaged resources in a repo-managed folder.
	if obj.GetFolder() != "" && obj.GetFolder() == previous.GetFolder() {
		newMgr, newOk := obj.GetManagerProperties()
		oldMgr, oldOk := previous.GetManagerProperties()
		if newOk != oldOk || newMgr != oldMgr {
			if err := s.ensureRepoManagedByParentFolder(ctx, obj); err != nil {
				return v, err
			}
		}
	}

	// Mark the resource as changed
	if v.hasChanged {
		obj.SetGeneration(previous.GetGeneration() + 1)
		updatedBy := info.GetUID()
		if metaUID, ok := identity.MetadataIdentityUIDFrom(ctx); ok {
			updatedBy = metaUID
		}
		obj.SetUpdatedBy(updatedBy)
		obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())
	} else {
		obj.SetGeneration(previous.GetGeneration())
		obj.SetAnnotation(utils.AnnoKeyUpdatedBy, previous.GetAnnotation(utils.AnnoKeyUpdatedBy))
		obj.SetAnnotation(utils.AnnoKeyUpdatedTimestamp, previous.GetAnnotation(utils.AnnoKeyUpdatedTimestamp))
	}

	err = s.encode(updateObject, &v.raw)
	return v, err
}

func (s *Storage) ensureRepoManagedByParentFolder(ctx context.Context, obj utils.GrafanaMetaAccessor) error {
	if !s.opts.EnableFolderSupport || folder.IsRootFolderUID(obj.GetFolder()) {
		return nil
	}
	folder, err := s.getParentFolder(ctx, obj)
	if err != nil {
		return err
	}
	if folder == nil {
		return nil
	}
	return ensureSameRepoManager(folder, obj)
}

// getParentFolder fetches the folder that contains obj. Returns (nil, nil)
// when the dynamic client is not available, signalling the caller to skip
// the consistency check.
func (s *Storage) getParentFolder(ctx context.Context, obj utils.GrafanaMetaAccessor) (utils.GrafanaMetaAccessor, error) {
	if s.getDynClient == nil {
		logging.FromContext(ctx).Warn("skipping repo-manager consistency check: dynamic client not configured", "resource", s.gr.String())
		return nil, nil
	}
	dynClient, err := s.getDynClient(ctx)
	if err != nil {
		return nil, err
	}

	name := obj.GetFolder()
	gvr := folders.FolderResourceInfo.GroupVersionResource()
	raw, err := dynClient.Resource(gvr).Namespace(obj.GetNamespace()).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to read folder %s: %w", name, err)
	}

	return utils.MetaAccessor(raw)
}

func (s *Storage) checkGVK(obj runtime.Object) error {
	if s.opts.Scheme == nil {
		return nil // we can not do anything
	}

	// Ensure group+version+kind are configured
	info := obj.GetObjectKind()
	gvk := info.GroupVersionKind()
	if gvk.Group == "" || gvk.Kind == "" || gvk.Version == "" {
		gvks, _, err := s.opts.Scheme.ObjectKinds(obj)
		if err != nil {
			return fmt.Errorf("unknown object kind %w", err)
		}
		for _, v := range gvks {
			if v.Group != s.gr.Group {
				continue // skip values not in this group
			}
			gvk.Group = v.Group
			gvk.Kind = v.Kind
			if gvk.Version == "" {
				gvk.Version = v.Version
			}
			info.SetGroupVersionKind(gvk)
			return nil
		}
	}
	return nil
}

func (s *Storage) encode(obj runtime.Object, w io.Writer) error {
	// The standard encoder is fine when only one type maps to a group
	if s.opts.Scheme == nil {
		return s.codec.Encode(obj, w)
	}
	if err := s.checkGVK(obj); err != nil {
		return err
	}

	// This will always write the saved GVK, unlike:
	// https://github.com/kubernetes/kubernetes/blob/v1.34.3/staging/src/k8s.io/apimachinery/pkg/runtime/serializer/versioning/versioning.go#L267
	// that picks an arbitrary GVK that may not match the same group!
	return json.NewEncoder(w).Encode(obj)
}

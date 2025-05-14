package receiver

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/receiver/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	alertingac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type ReceiverService interface {
	GetReceiver(ctx context.Context, q ngmodels.GetReceiverQuery, user identity.Requester) (*ngmodels.Receiver, error)
	GetReceivers(ctx context.Context, q ngmodels.GetReceiversQuery, user identity.Requester) ([]*ngmodels.Receiver, error)
	CreateReceiver(ctx context.Context, r *ngmodels.Receiver, orgID int64, user identity.Requester) (*ngmodels.Receiver, error)
	UpdateReceiver(ctx context.Context, r *ngmodels.Receiver, storedSecureFields map[string][]string, orgID int64, user identity.Requester) (*ngmodels.Receiver, error)
	DeleteReceiver(ctx context.Context, name string, provenance definitions.Provenance, version string, orgID int64, user identity.Requester) error
}

type MetadataService interface {
	AccessControlMetadata(ctx context.Context, user identity.Requester, receivers ...*ngmodels.Receiver) (map[string]ngmodels.ReceiverPermissionSet, error)
	InUseMetadata(ctx context.Context, orgID int64, receivers ...*ngmodels.Receiver) (map[string]ngmodels.ReceiverMetadata, error)
}

type legacyStorage struct {
	service        ReceiverService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	metadata       MetadataService
}

func (s *legacyStorage) New() runtime.Object {
	return ResourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return ResourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return ResourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	q := ngmodels.GetReceiversQuery{
		OrgID:   orgId,
		Decrypt: false,
		//Names:   ctx.QueryStrings("names"), // TODO: Query params.
		//Limit:   ctx.QueryInt("limit"),
		//Offset:  ctx.QueryInt("offset"),
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.service.GetReceivers(ctx, q, user)
	if err != nil {
		// This API should not be returning a forbidden error when the user does not have access to any resources.
		// This can be true for a contact point creator role, for example.
		// This should eventually be changed downstream in the auth logic but provisioning API currently relies on this
		//  behaviour to return useful forbidden errors when exporting decrypted receivers.
		if !errors.Is(err, alertingac.ErrAuthorizationBase) {
			return nil, err
		}
		res = nil
	}

	accesses, err := s.metadata.AccessControlMetadata(ctx, user, res...)
	if err != nil {
		return nil, fmt.Errorf("failed to get access control metadata: %w", err)
	}

	inUses, err := s.metadata.InUseMetadata(ctx, orgId, res...)
	if err != nil {
		return nil, fmt.Errorf("failed to get in-use metadata: %w", err)
	}

	return convertToK8sResources(orgId, res, accesses, inUses, s.namespacer, opts.FieldSelector)
}

func (s *legacyStorage) Get(ctx context.Context, uid string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	name, err := legacy_storage.UidToName(uid)
	if err != nil {
		return nil, apierrors.NewNotFound(ResourceInfo.GroupResource(), uid)
	}
	q := ngmodels.GetReceiverQuery{
		OrgID:   info.OrgID,
		Name:    name,
		Decrypt: false,
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	r, err := s.service.GetReceiver(ctx, q, user)
	if err != nil {
		return nil, err
	}

	var access *ngmodels.ReceiverPermissionSet
	accesses, err := s.metadata.AccessControlMetadata(ctx, user, r)
	if err == nil {
		if a, ok := accesses[r.GetUID()]; ok {
			access = &a
		}
	} else {
		return nil, fmt.Errorf("failed to get access control metadata: %w", err)
	}

	var inUse *ngmodels.ReceiverMetadata
	inUses, err := s.metadata.InUseMetadata(ctx, info.OrgID, r)
	if err == nil {
		if a, ok := inUses[r.GetUID()]; ok {
			inUse = &a
		}
	} else {
		return nil, fmt.Errorf("failed to get access control metadata: %w", err)
	}

	return convertToK8sResource(info.OrgID, r, access, inUse, s.namespacer)
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	_ *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	p, ok := obj.(*model.Receiver)
	if !ok {
		return nil, fmt.Errorf("expected receiver but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	if p.ObjectMeta.Name != "" { // TODO remove when metadata.name can be defined by user
		return nil, apierrors.NewBadRequest("object's metadata.name should be empty")
	}
	model, _, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	out, err := s.service.CreateReceiver(ctx, model, info.OrgID, user)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, out, nil, nil, s.namespacer)
}

func (s *legacyStorage) Update(ctx context.Context,
	uid string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	_ bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, uid, nil)
	if err != nil {
		return old, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}
	p, ok := obj.(*model.Receiver)
	if !ok {
		return nil, false, fmt.Errorf("expected receiver but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	model, storedSecureFields, err := convertToDomainModel(p)
	if err != nil {
		return old, false, err
	}

	updated, err := s.service.UpdateReceiver(ctx, model, storedSecureFields, info.OrgID, user)
	if err != nil {
		return nil, false, err
	}

	r, err := convertToK8sResource(info.OrgID, updated, nil, nil, s.namespacer)
	return r, false, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, uid string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, uid, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err = deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}
	version := ""
	if options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		version = *options.Preconditions.ResourceVersion
	}

	err = s.service.DeleteReceiver(ctx, uid, definitions.Provenance(ngmodels.ProvenanceNone), version, info.OrgID, user) // TODO add support for dry-run option
	return old, false, err                                                                                               // false - will be deleted async
}

func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
}

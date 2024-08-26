package receiver

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	notifications "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	grafanaRest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

var (
	_ grafanaRest.LegacyStorage = (*legacyStorage)(nil)
)

var resourceInfo = notifications.ReceiverResourceInfo

type ReceiverService interface {
	GetReceiver(ctx context.Context, q ngmodels.GetReceiverQuery, user identity.Requester) (*ngmodels.Receiver, error)
	GetReceivers(ctx context.Context, q ngmodels.GetReceiversQuery, user identity.Requester) ([]*ngmodels.Receiver, error)
	CreateReceiver(ctx context.Context, r *ngmodels.Receiver, orgID int64, user identity.Requester) (*ngmodels.Receiver, error)
	UpdateReceiver(ctx context.Context, r *ngmodels.Receiver, storedSecureFields map[string][]string, orgID int64, user identity.Requester) (*ngmodels.Receiver, error)
	DeleteReceiver(ctx context.Context, name string, provenance definitions.Provenance, version string, orgID int64, user identity.Requester) error
}

type legacyStorage struct {
	service        ReceiverService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
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
		return nil, err
	}

	return convertToK8sResources(orgId, res, s.namespacer)
}

func (s *legacyStorage) Get(ctx context.Context, uid string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	name, err := legacy_storage.UidToName(uid)
	if err != nil {
		return nil, errors.NewNotFound(resourceInfo.GroupResource(), uid)
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
	return convertToK8sResource(info.OrgID, r, s.namespacer)
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
	p, ok := obj.(*notifications.Receiver)
	if !ok {
		return nil, fmt.Errorf("expected receiver but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	if p.ObjectMeta.Name != "" { // TODO remove when metadata.name can be defined by user
		return nil, errors.NewBadRequest("object's metadata.name should be empty")
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
	return convertToK8sResource(info.OrgID, out, s.namespacer)
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
	p, ok := obj.(*notifications.Receiver)
	if !ok {
		return nil, false, fmt.Errorf("expected receiver but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	model, storedSecureFields, err := convertToDomainModel(p)
	if err != nil {
		return old, false, err
	}

	if p.ObjectMeta.Name != model.GetUID() {
		return nil, false, errors.NewBadRequest("title cannot be changed. Consider creating a new resource.")
	}

	updated, err := s.service.UpdateReceiver(ctx, model, storedSecureFields, info.OrgID, user)
	if err != nil {
		return nil, false, err
	}

	r, err := convertToK8sResource(info.OrgID, updated, s.namespacer)
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
	return nil, errors.NewMethodNotSupported(resourceInfo.GroupResource(), "deleteCollection")
}

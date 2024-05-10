package receiver

import (
	"context"
	goerrors "errors"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	notifications "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

var (
	_ grafanarest.LegacyStorage = (*legacyGroupStorage)(nil)
)

type ReceiverService interface {
	GetReceiver(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error)
	GetReceivers(ctx context.Context, q models.GetReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error)
}

var resourceInfo = notifications.ReceiverResourceInfo

type legacyGroupStorage struct {
	service        ReceiverService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyGroupStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(resourceInfo.GroupResource(), "deleteCollection")
}

func (s *legacyGroupStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyGroupStorage) Destroy() {}

func (s *legacyGroupStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyGroupStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyGroupStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyGroupStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyGroupStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	// TODO implement pagination
	res, err := s.service.GetReceivers(ctx, models.GetReceiversQuery{
		OrgID:   orgId,
		Decrypt: false,
	}, user)
	if err != nil {
		return nil, err
	}

	return convertToK8sResources(orgId, res, s.namespacer), nil
}

func (s *legacyGroupStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.GetReceiver(ctx, models.GetReceiverQuery{
		OrgID:   info.OrgID,
		Name:    name,
		Decrypt: false,
	}, user)

	if err != nil {
		if goerrors.Is(err, notifier.ErrNotFound) {
			return nil, errors.NewNotFound(resourceInfo.SingularGroupResource(), name)
		}
		return nil, err
	}
	return convertToK8sResource(info.OrgID, dto, s.namespacer), nil
}

func (s *legacyGroupStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	_ *metav1.CreateOptions,
) (runtime.Object, error) {
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	_, ok := obj.(*notifications.Receiver)
	if !ok {
		return nil, fmt.Errorf("expected template but got %s", obj.GetObjectKind().GroupVersionKind())
	}

	return nil, errors.NewMethodNotSupported(resourceInfo.GroupResource(), "create new")
}

func (s *legacyGroupStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	_ bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	create := old == nil
	if create {
		if createValidation != nil {
			if err := createValidation(ctx, obj); err != nil {
				return nil, false, err
			}
		}
	} else {
		if updateValidation != nil {
			if err := updateValidation(ctx, obj, old); err != nil {
				return nil, false, err
			}
		}
	}
	return nil, false, errors.NewMethodNotSupported(resourceInfo.GroupResource(), "update")
}

// GracefulDeleter
func (s *legacyGroupStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err = deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}
	return nil, false, errors.NewMethodNotSupported(resourceInfo.GroupResource(), "update")
}

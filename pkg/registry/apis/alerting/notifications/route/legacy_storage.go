package route

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	notifications "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
	_ rest.CollectionDeleter    = (*legacyStorage)(nil)
)

var resourceInfo = notifications.RouteResourceInfo

type RouteService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (definitions.RoutingTree, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.RoutingTree) error
	ResetPolicyTree(ctx context.Context, orgID int64) (definitions.RoutingTree, error)
}

type legacyStorage struct {
	service        RouteService
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

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.service.GetPolicyTree(ctx, orgId)
	if err != nil {
		return nil, err
	}

	return convertToK8sResource(orgId, res, s.namespacer)
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
	p, ok := obj.(*notifications.Route)
	if !ok {
		return nil, fmt.Errorf("expected route but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	if p.ObjectMeta.Name != "" { // TODO remove when metadata.name can be defined by user
		return nil, errors.NewBadRequest("object's metadata.name should be empty")
	}
	model, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}
	err = s.service.UpdatePolicyTree(ctx, info.OrgID, model)
	if err != nil {
		return nil, err
	}

	res, err := s.service.GetPolicyTree(ctx, info.OrgID)
	if err != nil {
		return nil, err
	}

	return convertToK8sResource(info.OrgID, res, s.namespacer)
}

// Delete implements rest.GracefulDeleter. It is needed for API server to not crash when it registers DeleteCollection method
func (s *legacyStorage) Delete(_ context.Context, _ string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, errors.NewMethodNotSupported(resourceInfo.GroupResource(), "delete")
}

func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	old, err := s.List(ctx, nil)
	if err != nil {
		return old, err
	}

	if deleteValidation != nil {
		if err = deleteValidation(ctx, old); err != nil {
			return nil, err
		}
	}

	_, err = s.service.ResetPolicyTree(ctx, info.OrgID) // TODO add support for dry-run option
	return old, err                                     // false - will be deleted async
}

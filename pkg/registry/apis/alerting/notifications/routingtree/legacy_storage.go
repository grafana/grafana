package routingtree

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/routingtree/v0alpha1"
	grafanaRest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	_ grafanaRest.LegacyStorage = (*legacyStorage)(nil)
)

type RouteService interface {
	GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error)
	UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p alerting_models.Provenance, version string) (definitions.Route, string, error)
	ResetPolicyTree(ctx context.Context, orgID int64, p alerting_models.Provenance) (definitions.Route, error)
}

type legacyStorage struct {
	service        RouteService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
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

func (s *legacyStorage) getUserDefinedRoutingTree(ctx context.Context) (*model.RoutingTree, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	res, version, err := s.service.GetPolicyTree(ctx, orgId)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(orgId, res, version, s.namespacer)
}

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	user, err := s.getUserDefinedRoutingTree(ctx)
	if err != nil {
		return nil, err
	}
	return &model.RoutingTreeList{
		Items: []model.RoutingTree{
			*user,
		},
	}, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if name != model.UserDefinedRoutingTreeName {
		return nil, errors.NewNotFound(ResourceInfo.GroupResource(), name)
	}
	return s.getUserDefinedRoutingTree(ctx)
}

func (s *legacyStorage) Create(_ context.Context,
	_ runtime.Object,
	_ rest.ValidateObjectFunc,
	_ *metav1.CreateOptions,
) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "create")
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if name != model.UserDefinedRoutingTreeName {
		return nil, false, errors.NewNotFound(ResourceInfo.GroupResource(), name)
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, model.UserDefinedRoutingTreeName, nil)
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
	p, ok := obj.(*model.RoutingTree)
	if !ok {
		return nil, false, fmt.Errorf("expected %s but got %s", ResourceInfo.GroupVersionKind(), obj.GetObjectKind().GroupVersionKind())
	}

	model, version, err := convertToDomainModel(p)
	if err != nil {
		return nil, false, err
	}
	updated, updatedVersion, err := s.service.UpdatePolicyTree(ctx, info.OrgID, model, alerting_models.ProvenanceNone, version)
	if err != nil {
		return nil, false, err
	}

	obj, err = convertToK8sResource(info.OrgID, updated, updatedVersion, s.namespacer)
	return obj, false, err
}

// Delete implements rest.GracefulDeleter. It is needed for API server to not crash when it registers DeleteCollection method
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, opts *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if name != model.UserDefinedRoutingTreeName {
		return nil, false, errors.NewNotFound(ResourceInfo.GroupResource(), name)
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
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
	_, err = s.service.ResetPolicyTree(ctx, info.OrgID, alerting_models.ProvenanceNone) // TODO add support for dry-run option
	return old, false, err
}

func (s *legacyStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "delete")
}

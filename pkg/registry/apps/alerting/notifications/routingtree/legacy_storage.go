package routingtree

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type RouteService interface {
	GetManagedRoutes(ctx context.Context, orgID int64) (legacy_storage.ManagedRoutes, error)
	GetManagedRoute(ctx context.Context, orgID int64, name string) (legacy_storage.ManagedRoute, error)
	DeleteManagedRoute(ctx context.Context, orgID int64, name string, p alerting_models.Provenance, version string) error
	CreateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p alerting_models.Provenance) (*legacy_storage.ManagedRoute, error)
	UpdateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p alerting_models.Provenance, version string) (*legacy_storage.ManagedRoute, error)
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

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	managedRoutes, err := s.service.GetManagedRoutes(ctx, orgId)
	if err != nil {
		return nil, err
	}
	return ConvertToK8sResources(orgId, managedRoutes, s.namespacer)
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	managedRoute, err := s.service.GetManagedRoute(ctx, info.OrgID, name)
	if err != nil {
		return nil, err
	}
	return ConvertToK8sResource(info.OrgID, &managedRoute, s.namespacer)
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
	p, ok := obj.(*model.RoutingTree)
	if !ok {
		return nil, fmt.Errorf("expected %s but got %s", ResourceInfo.GroupVersionKind(), obj.GetObjectKind().GroupVersionKind())
	}
	domainModel, _, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}
	created, err := s.service.CreateManagedRoute(ctx, info.OrgID, p.Name, domainModel, alerting_models.ProvenanceNone)
	if err != nil {
		return nil, err
	}

	return ConvertToK8sResource(info.OrgID, created, s.namespacer)
}

func (s *legacyStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	_ rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	_ bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
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

	domainModel, version, err := convertToDomainModel(p)
	if err != nil {
		return nil, false, err
	}
	updated, err := s.service.UpdateManagedRoute(ctx, info.OrgID, p.Name, domainModel, alerting_models.ProvenanceNone, version)
	if err != nil {
		return nil, false, err
	}

	obj, err = ConvertToK8sResource(info.OrgID, updated, s.namespacer)
	return obj, false, err
}

// Delete implements rest.GracefulDeleter. It is needed for API server to not crash when it registers DeleteCollection method
func (s *legacyStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
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
	version := ""
	if options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		version = *options.Preconditions.ResourceVersion
	}
	err = s.service.DeleteManagedRoute(ctx, info.OrgID, name, alerting_models.ProvenanceNone, version) // TODO add support for dry-run option
	return old, false, err
}

func (s *legacyStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
}

package routingtree

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	GetManagedRoutes(ctx context.Context, orgID int64, user identity.Requester) (legacy_storage.ManagedRoutes, error)
	GetManagedRoute(ctx context.Context, orgID int64, name string, user identity.Requester) (legacy_storage.ManagedRoute, error)
	DeleteManagedRoute(ctx context.Context, orgID int64, name string, p alerting_models.Provenance, version string, user identity.Requester) error
	CreateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p alerting_models.Provenance, user identity.Requester) (*legacy_storage.ManagedRoute, error)
	UpdateManagedRoute(ctx context.Context, orgID int64, name string, subtree definitions.Route, p alerting_models.Provenance, version string, user identity.Requester) (*legacy_storage.ManagedRoute, error)
}

type MetadataService interface {
	AccessControlMetadata(ctx context.Context, user identity.Requester, receivers ...*legacy_storage.ManagedRoute) (map[string]alerting_models.RoutePermissionSet, error)
}

type legacyStorage struct {
	service        RouteService
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

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	managedRoutes, err := s.service.GetManagedRoutes(ctx, orgId, user)
	if err != nil {
		return nil, err
	}

	set, err := s.metadata.AccessControlMetadata(ctx, user, managedRoutes...)
	if err != nil {
		return nil, fmt.Errorf("failed to get access control metadata: %w", err)
	}
	return ConvertToK8sResources(orgId, managedRoutes, s.namespacer, set)
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	managedRoute, err := s.service.GetManagedRoute(ctx, info.OrgID, name, user)
	if err != nil {
		return nil, err
	}

	accesses, err := s.metadata.AccessControlMetadata(ctx, user, &managedRoute)
	if err != nil {
		return nil, fmt.Errorf("failed to get access control metadata: %w", err)
	}
	var access *alerting_models.RoutePermissionSet
	if a, ok := accesses[managedRoute.GetUID()]; ok {
		access = &a
	}
	return ConvertToK8sResource(info.OrgID, &managedRoute, s.namespacer, access)
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
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	domainModel, _, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}
	prov, err := alerting_models.ProvenanceFromString(p.GetProvenanceStatus())
	if err != nil {
		return nil, errors.NewBadRequest(err.Error())
	}
	created, err := s.service.CreateManagedRoute(ctx, info.OrgID, p.Name, domainModel, prov, user)
	if err != nil {
		return nil, err
	}

	accesses, err := s.metadata.AccessControlMetadata(ctx, user, created)
	if err != nil {
		return nil, fmt.Errorf("failed to get access control metadata: %w", err)
	}
	var access *alerting_models.RoutePermissionSet
	if a, ok := accesses[created.GetUID()]; ok {
		access = &a
	}
	return ConvertToK8sResource(info.OrgID, created, s.namespacer, access)
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

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	domainModel, version, err := convertToDomainModel(p)
	if err != nil {
		return nil, false, err
	}
	prov, err := alerting_models.ProvenanceFromString(p.GetProvenanceStatus())
	if err != nil {
		return nil, false, errors.NewBadRequest(err.Error())
	}
	updated, err := s.service.UpdateManagedRoute(ctx, info.OrgID, p.Name, domainModel, prov, version, user)
	if err != nil {
		return nil, false, err
	}

	accesses, err := s.metadata.AccessControlMetadata(ctx, user, updated)
	if err != nil {
		return nil, false, fmt.Errorf("failed to get access control metadata: %w", err)
	}
	var access *alerting_models.RoutePermissionSet
	if a, ok := accesses[updated.GetUID()]; ok {
		access = &a
	}
	obj, err = ConvertToK8sResource(info.OrgID, updated, s.namespacer, access)
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
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	version := ""
	if options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		version = *options.Preconditions.ResourceVersion
	}
	oldTree, ok := old.(*model.RoutingTree)
	if !ok {
		return nil, false, fmt.Errorf("expected %s but got %s", ResourceInfo.GroupVersionKind(), old.GetObjectKind().GroupVersionKind())
	}
	prov, err := alerting_models.ProvenanceFromString(oldTree.GetProvenanceStatus())
	if err != nil {
		return nil, false, errors.NewBadRequest(err.Error())
	}
	err = s.service.DeleteManagedRoute(ctx, info.OrgID, name, prov, version, user) // TODO add support for dry-run option
	return old, false, err
}

func (s *legacyStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
}

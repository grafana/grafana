package dashboard

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/setting"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

var (
	_ rest.Scoper               = (*LibraryPanelStore)(nil)
	_ rest.SingularNameProvider = (*LibraryPanelStore)(nil)
	_ rest.Getter               = (*LibraryPanelStore)(nil)
	_ rest.Lister               = (*LibraryPanelStore)(nil)
	_ rest.Creater              = (*LibraryPanelStore)(nil)
	_ rest.GracefulDeleter      = (*LibraryPanelStore)(nil)
	_ rest.Updater              = (*LibraryPanelStore)(nil)
	_ rest.Storage              = (*LibraryPanelStore)(nil)
)

type LibraryPanelStore struct {
	Access                legacy.DashboardAccess
	ResourceInfo          utils.ResourceInfo
	LibraryElementService libraryelements.Service
	Cfg                   *setting.Cfg
}

func (s *LibraryPanelStore) New() runtime.Object {
	return s.ResourceInfo.NewFunc()
}

func (s *LibraryPanelStore) Destroy() {}

func (s *LibraryPanelStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *LibraryPanelStore) GetSingularName() string {
	return s.ResourceInfo.GetSingularName()
}

func (s *LibraryPanelStore) NewList() runtime.Object {
	return s.ResourceInfo.NewListFunc()
}

func (s *LibraryPanelStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.ResourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *LibraryPanelStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if options.ResourceVersion != "" {
		return nil, apierrors.NewBadRequest("List with explicit resourceVersion is not supported with this storage backend")
	}
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	query := legacy.LibraryPanelQuery{
		OrgID: ns.OrgID,
		Limit: options.Limit,
	}
	if options.Continue != "" {
		query.LastID, err = strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid continue token")
		}
	}
	if query.Limit < 1 {
		query.Limit = 25
	}
	return s.Access.GetLibraryPanels(ctx, query)
}

func (s *LibraryPanelStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	query := legacy.LibraryPanelQuery{
		OrgID: ns.OrgID,
		UID:   name,
		Limit: 1,
	}
	found, err := s.Access.GetLibraryPanels(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(found.Items) == 1 {
		return &found.Items[0], nil
	}
	return nil, s.ResourceInfo.NewNotFound(name)
}

func (s *LibraryPanelStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	panel, ok := obj.(*dashboardV0.LibraryPanel)
	if !ok {
		return nil, apierrors.NewBadRequest("expected LibraryPanel object")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("unable to get user from context")
	}

	cmd, err := libraryelements.ConvertToLegacyCreateCommand(panel, ns.OrgID)
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("conversion error: %v", err))
	}

	dto, err := s.LibraryElementService.CreateElement(ctx, user, *cmd)
	if err != nil {
		if err == model.ErrLibraryElementAlreadyExists {
			return nil, apierrors.NewAlreadyExists(s.ResourceInfo.GroupResource(), panel.Name)
		}
		return nil, apierrors.NewInternalError(err)
	}

	namespacer := request.GetNamespaceMapper(s.Cfg)
	result, err := libraryelements.ConvertToK8sResource(&dto, namespacer)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to convert result: %w", err))
	}

	return result, nil
}

func (s *LibraryPanelStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, apierrors.NewUnauthorized("unable to get user from context")
	}

	oldObj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) && forceAllowCreate {
			newObj, err := objInfo.UpdatedObject(ctx, nil)
			if err != nil {
				return nil, false, err
			}
			created, err := s.Create(ctx, newObj, createValidation, &metav1.CreateOptions{})
			return created, true, err
		}
		return nil, false, err
	}

	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}

	panel, ok := newObj.(*dashboardV0.LibraryPanel)
	if !ok {
		return nil, false, apierrors.NewBadRequest("expected LibraryPanel object")
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, newObj, oldObj); err != nil {
			return nil, false, err
		}
	}

	oldPanel := oldObj.(*dashboardV0.LibraryPanel)
	version, err := strconv.ParseInt(oldPanel.ResourceVersion, 10, 64)
	if err != nil {
		return nil, false, apierrors.NewBadRequest("invalid resource version")
	}

	cmd, err := libraryelements.ConvertToLegacyPatchCommand(panel, ns.OrgID, version)
	if err != nil {
		return nil, false, apierrors.NewBadRequest(fmt.Sprintf("conversion error: %v", err))
	}

	dto, err := s.LibraryElementService.PatchElement(ctx, user, *cmd, name)
	if err != nil {
		if err == model.ErrLibraryElementNotFound {
			return nil, false, apierrors.NewNotFound(s.ResourceInfo.GroupResource(), name)
		}
		if err == model.ErrLibraryElementVersionMismatch {
			return nil, false, apierrors.NewConflict(s.ResourceInfo.GroupResource(), name, err)
		}
		return nil, false, apierrors.NewInternalError(err)
	}

	namespacer := request.GetNamespaceMapper(s.Cfg)
	result, err := libraryelements.ConvertToK8sResource(&dto, namespacer)
	if err != nil {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to convert result: %w", err))
	}

	return result, false, nil
}

func (s *LibraryPanelStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	if deleteValidation != nil {
		if err := deleteValidation(ctx, obj); err != nil {
			return nil, false, err
		}
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, apierrors.NewUnauthorized("unable to get user from context")
	}

	// TODO: check if there are any connections to this element, and if so, that those dashboards actually exist
	// probably should be in the validation hook instead
	_, err = s.LibraryElementService.DeleteElement(ctx, user, name)
	if err != nil {
		if err == model.ErrLibraryElementNotFound {
			return nil, false, apierrors.NewNotFound(s.ResourceInfo.GroupResource(), name)
		}
		if err == model.ErrLibraryElementHasConnections {
			return nil, false, apierrors.NewBadRequest("library element has connections and cannot be deleted")
		}
		return nil, false, apierrors.NewInternalError(err)
	}

	return obj, true, nil
}

func (s *LibraryPanelStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(s.ResourceInfo.GroupResource(), "deletecollection")
}

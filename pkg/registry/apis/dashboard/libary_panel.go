package dashboard

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
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
	Access       legacy.DashboardAccessor
	ResourceInfo utils.ResourceInfo
	service      libraryelements.Service
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

// translateLegacyError maps library element service errors onto k8s status errors
// so that API clients (and the legacy /api wrapper handlers) can react to the
// failure reason instead of receiving an opaque 500.
func (s *LibraryPanelStore) translateLegacyError(name string, err error) error {
	if err == nil {
		return nil
	}
	gr := s.ResourceInfo.GroupResource()
	switch {
	case errors.Is(err, model.ErrLibraryElementNotFound):
		return s.ResourceInfo.NewNotFound(name)
	case errors.Is(err, model.ErrLibraryElementAlreadyExists):
		return apierrors.NewAlreadyExists(gr, name)
	// the legacy API reports both as 409 Conflict; the /api wrapper distinguishes
	// them by message to keep returning 412 for version mismatches
	case errors.Is(err, model.ErrLibraryElementVersionMismatch),
		errors.Is(err, model.ErrLibraryElementProvisionedFolder):
		return apierrors.NewConflict(gr, name, err)
	case errors.Is(err, model.ErrLibraryElementHasConnections),
		errors.Is(err, model.ErrLibraryElementInsufficientPermissions),
		errors.Is(err, folder.ErrAccessDenied):
		return apierrors.NewForbidden(gr, name, err)
	case errors.Is(err, model.ErrLibraryElementInvalidUID),
		errors.Is(err, model.ErrLibraryElementUIDTooLong),
		errors.Is(err, model.ErrLibraryElementUnSupportedElementKind),
		errors.Is(err, dashboards.ErrFolderNotFound):
		return apierrors.NewBadRequest(err.Error())
	}
	return err
}

func (s *LibraryPanelStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	cmd, err := libraryelements.ToCreateLibraryElementCommand(obj)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}

	// NOTE: this includes all access control checks
	out, err := s.service.CreateElement(ctx, user, *cmd)
	if err != nil {
		return nil, s.translateLegacyError(cmd.UID, err)
	}
	if out.UID == "" {
		return nil, fmt.Errorf("created library panel has empty UID")
	}
	return s.Get(ctx, out.UID, &metav1.GetOptions{})
}

func (s *LibraryPanelStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	old, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	// NOTE: this includes all access control checks
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}

	cmd, err := libraryelements.ToPatchLibraryElementCommand(obj)
	if err != nil {
		return nil, false, apierrors.NewBadRequest(err.Error())
	}

	out, err := s.service.PatchLibraryElement(ctx, user, *cmd, name)
	if err != nil {
		return nil, false, s.translateLegacyError(name, err)
	}
	if out.UID == "" {
		return nil, false, fmt.Errorf("created library panel has empty UID")
	}
	obj, err = s.Get(ctx, out.UID, &metav1.GetOptions{})
	return obj, false, err
}

func (s *LibraryPanelStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	// NOTE: this includes all access control checks
	_, err = s.service.DeleteLibraryElement(ctx, user, name)
	if err != nil {
		return nil, false, s.translateLegacyError(name, err)
	}
	return nil, true, nil
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

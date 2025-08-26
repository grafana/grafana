package libraryelements

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
)

func isGeneralFolder(folderID int64) bool {
	return folderID == 0
}

func isUIDGeneralFolder(folderUID string) bool {
	return folderUID == accesscontrol.GeneralFolderUID
}

func (l *LibraryElementService) requireSupportedElementKind(kindAsInt int64) error {
	kind := model.LibraryElementKind(kindAsInt)
	switch kind {
	case model.PanelElement:
		return nil
	default:
		return model.ErrLibraryElementUnSupportedElementKind
	}
}

func (l *LibraryElementService) requireEditPermissionsOnFolderUID(ctx context.Context, user identity.Requester, folderUID string) error {
	// TODO remove these special cases and handle General folder case in access control guardian
	if isUIDGeneralFolder(folderUID) && user.HasRole(org.RoleEditor) {
		return nil
	}

	if isUIDGeneralFolder(folderUID) && user.HasRole(org.RoleViewer) {
		return dashboards.ErrFolderAccessDenied
	}

	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
	canEdit, err := l.AccessControl.Evaluate(ctx, user, evaluator)
	if err != nil {
		return err
	}
	if !canEdit {
		return dashboards.ErrFolderAccessDenied
	}

	return nil
}

func (l *LibraryElementService) requireViewPermissionsOnFolder(ctx context.Context, user identity.Requester, folderID int64) error {
	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(folderID, 10)))
	if isGeneralFolder(folderID) {
		evaluator = accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID))
	}
	canView, err := l.AccessControl.Evaluate(ctx, user, evaluator)
	if err != nil {
		return err
	}
	if !canView {
		return dashboards.ErrFolderAccessDenied
	}

	return nil
}

func (l *LibraryElementService) requireViewPermissionsOnFolderUID(ctx context.Context, user identity.Requester, folderUID string) error {
	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
	canView, err := l.AccessControl.Evaluate(ctx, user, evaluator)
	if err != nil {
		return err
	}
	if !canView {
		return dashboards.ErrFolderAccessDenied
	}

	return nil
}

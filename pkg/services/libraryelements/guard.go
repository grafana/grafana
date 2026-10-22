package libraryelements

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
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
		return folder.ErrAccessDenied
	}

	evaluator := accesscontrol.EvalPermission(folder.ActionFoldersWrite, folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
	canEdit, err := l.AccessControl.Evaluate(ctx, user, evaluator)
	if err != nil {
		return err
	}
	if !canEdit {
		return folder.ErrAccessDenied
	}

	return nil
}

// RequireEditPermissionsOnFolder returns nil if signedInUser can edit library elements in
// folderUID, translating the "folder's access-control scope resolver found no such folder" error
// into dashboards.ErrFolderNotFound the same way DeleteLibraryElementsInFolder does. Exported so a
// caller that must check several folders before deleting any of them (e.g. a multi-folder cascade
// delete) can run the check up front without going through the delete path itself.
func (l *LibraryElementService) RequireEditPermissionsOnFolder(ctx context.Context, user identity.Requester, folderUID string) error {
	if err := l.requireEditPermissionsOnFolderUID(ctx, user, folderUID); err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			return dashboards.ErrFolderNotFound
		}
		return err
	}
	return nil
}

func (l *LibraryElementService) requireViewPermissionsOnFolderUID(ctx context.Context, user identity.Requester, folderUID string) error {
	evaluator := accesscontrol.EvalPermission(folder.ActionFoldersRead, folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
	canView, err := l.AccessControl.Evaluate(ctx, user, evaluator)
	if err != nil {
		return err
	}
	if !canView {
		return folder.ErrAccessDenied
	}

	return nil
}

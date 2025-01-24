package libraryelements

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
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
	case model.VariableElement:
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

	g, err := guardian.NewByFolderUID(ctx, folderUID, user.GetOrgID(), user)
	if err != nil {
		return err
	}

	canEdit, err := g.CanEdit()
	if err != nil {
		return err
	}
	if !canEdit {
		return dashboards.ErrFolderAccessDenied
	}

	return nil
}

func (l *LibraryElementService) requireEditPermissionsOnFolder(ctx context.Context, user identity.Requester, folderID int64) error {
	// TODO remove these special cases and handle General folder case in access control guardian
	if isGeneralFolder(folderID) && user.HasRole(org.RoleEditor) {
		return nil
	}

	if isGeneralFolder(folderID) && user.HasRole(org.RoleViewer) {
		return dashboards.ErrFolderAccessDenied
	}

	g, err := guardian.NewByFolder(ctx, &folder.Folder{
		ID:    folderID,
		OrgID: user.GetOrgID(),
	}, user.GetOrgID(), user)
	if err != nil {
		return err
	}

	canEdit, err := g.CanEdit()
	if err != nil {
		return err
	}
	if !canEdit {
		return dashboards.ErrFolderAccessDenied
	}

	return nil
}

func (l *LibraryElementService) requireViewPermissionsOnFolder(ctx context.Context, user identity.Requester, folderID int64) error {
	if isGeneralFolder(folderID) {
		return nil
	}

	g, err := guardian.NewByFolder(ctx, &folder.Folder{
		ID:    folderID,
		OrgID: user.GetOrgID(),
	}, user.GetOrgID(), user)
	if err != nil {
		return err
	}

	canView, err := g.CanView()
	if err != nil {
		return err
	}
	if !canView {
		return dashboards.ErrFolderAccessDenied
	}

	return nil
}

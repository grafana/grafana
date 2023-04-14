package libraryelements

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
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

func (l *LibraryElementService) requireEditPermissionsOnFolder(ctx context.Context, user *user.SignedInUser, folderID int64) error {
	if isGeneralFolder(folderID) && user.HasRole(org.RoleEditor) {
		return nil
	}

	if isGeneralFolder(folderID) && user.HasRole(org.RoleViewer) {
		return dashboards.ErrFolderAccessDenied
	}

	g, err := guardian.New(ctx, folderID, user.OrgID, user)
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

func (l *LibraryElementService) requireViewPermissionsOnFolder(ctx context.Context, user *user.SignedInUser, folderID int64) error {
	if isGeneralFolder(folderID) && user.HasRole(org.RoleViewer) {
		return nil
	}

	g, err := guardian.New(ctx, folderID, user.OrgID, user)
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

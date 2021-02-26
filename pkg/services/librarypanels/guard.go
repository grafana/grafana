package librarypanels

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func isGeneralFolder(folderID int64) bool {
	return folderID == 0
}

func hasPermissionsOnFolder(user *models.SignedInUser, folderID int64) (bool, error) {
	if isGeneralFolder(folderID) && user.HasRole(models.ROLE_EDITOR) {
		return true, nil
	}

	if isGeneralFolder(folderID) && user.HasRole(models.ROLE_VIEWER) {
		return false, models.ErrFolderAccessDenied
	}

	s := dashboards.NewFolderService(user.OrgId, user)
	folder, err := s.GetFolderByID(folderID)
	if err != nil {
		return false, err
	}

	g := guardian.New(folder.Id, user.OrgId, user)

	canEdit, err := g.CanEdit()

	return canEdit, err
}

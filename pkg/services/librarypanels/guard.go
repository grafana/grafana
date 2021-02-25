package librarypanels

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func isGeneralFolder(folderID int64) bool {
	return folderID == 0
}

func doesFolderExist(session *sqlstore.DBSession, user *models.SignedInUser, folderID int64) (bool, error) {
	if isGeneralFolder(folderID) {
		return true, nil
	}

	builder := sqlstore.SQLBuilder{}
	builder.Write("SELECT 1 FROM dashboard")
	builder.Write(` WHERE org_id=? AND id=?`, user.OrgId, folderID)
	count, err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Count()
	if err != nil {
		return false, err
	}
	if count == 0 {
		return false, models.ErrFolderNotFound
	}
	if count > 1 {
		return false, fmt.Errorf("found %d folders, while expecting at most one", count)
	}

	return true, nil
}

func doesUserHaveEditorPermissionsOnFolder(session *sqlstore.DBSession, user *models.SignedInUser, folderID int64) (bool, error) {
	if isGeneralFolder(folderID) && user.HasRole(models.ROLE_EDITOR) {
		return true, nil
	}

	if isGeneralFolder(folderID) && user.HasRole(models.ROLE_VIEWER) {
		return false, models.ErrFolderAccessDenied
	}

	builder := sqlstore.SQLBuilder{}
	builder.Write("SELECT 1 FROM dashboard AS dashboard")
	builder.Write(` WHERE dashboard.org_id=? AND dashboard.id=?`, user.OrgId, folderID)
	if user.OrgRole != models.ROLE_ADMIN {
		builder.WriteDashboardPermissionFilter(user, models.PERMISSION_EDIT)
	}
	count, err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Count()
	if err != nil {
		return false, err
	}
	if count == 0 {
		return false, models.ErrFolderAccessDenied
	}
	if count > 1 {
		return false, fmt.Errorf("found %d folders, while expecting at most one", count)
	}

	return true, nil
}

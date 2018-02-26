package api

import (
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
)

func GetFolderPermissionList(c *middleware.Context) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folder, err := s.GetFolderByUid(c.Params(":uid"))

	if err != nil {
		return toFolderError(err)
	}

	guardian := guardian.New(folder.Id, c.OrgId, c.SignedInUser)

	if canAdmin, err := guardian.CanAdmin(); err != nil || !canAdmin {
		return toFolderError(m.ErrFolderAccessDenied)
	}

	acl, err := guardian.GetAcl()
	if err != nil {
		return ApiError(500, "Failed to get folder permissions", err)
	}

	for _, perm := range acl {
		perm.FolderId = folder.Id
		perm.DashboardId = 0

		if perm.Slug != "" {
			perm.Url = m.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}
	}

	return Json(200, acl)
}

func UpdateFolderPermissions(c *middleware.Context, apiCmd dtos.UpdateDashboardAclCommand) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folder, err := s.GetFolderByUid(c.Params(":uid"))

	if err != nil {
		return toFolderError(err)
	}

	guardian := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	canAdmin, err := guardian.CanAdmin()
	if err != nil {
		return toFolderError(err)
	}

	if !canAdmin {
		return toFolderError(m.ErrFolderAccessDenied)
	}

	cmd := m.UpdateDashboardAclCommand{}
	cmd.DashboardId = folder.Id

	for _, item := range apiCmd.Items {
		cmd.Items = append(cmd.Items, &m.DashboardAcl{
			OrgId:       c.OrgId,
			DashboardId: folder.Id,
			UserId:      item.UserId,
			TeamId:      item.TeamId,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	if okToUpdate, err := guardian.CheckPermissionBeforeUpdate(m.PERMISSION_ADMIN, cmd.Items); err != nil || !okToUpdate {
		if err != nil {
			return ApiError(500, "Error while checking folder permissions", err)
		}

		return ApiError(403, "Cannot remove own admin permission for a folder", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrDashboardAclInfoMissing {
			err = m.ErrFolderAclInfoMissing
		}
		if err == m.ErrDashboardPermissionDashboardEmpty {
			err = m.ErrFolderPermissionFolderEmpty
		}

		if err == m.ErrFolderAclInfoMissing || err == m.ErrFolderPermissionFolderEmpty {
			return ApiError(409, err.Error(), err)
		}

		return ApiError(500, "Failed to create permission", err)
	}

	return ApiSuccess("Folder permissions updated")
}

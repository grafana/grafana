package api

import (
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) GetFolderPermissionList(c *models.ReqContext) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folder, err := s.GetFolderByUID(c.Params(":uid"))

	if err != nil {
		return toFolderError(err)
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return toFolderError(models.ErrFolderAccessDenied)
	}

	acl, err := g.GetAcl()
	if err != nil {
		return Error(500, "Failed to get folder permissions", err)
	}

	filteredAcls := make([]*models.DashboardAclInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.FolderId = folder.Id
		perm.DashboardId = 0

		perm.UserAvatarUrl = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamId > 0 {
			perm.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}

		if perm.Slug != "" {
			perm.Url = models.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}

		filteredAcls = append(filteredAcls, perm)
	}

	return JSON(200, filteredAcls)
}

func (hs *HTTPServer) UpdateFolderPermissions(c *models.ReqContext, apiCmd dtos.UpdateDashboardAclCommand) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folder, err := s.GetFolderByUID(c.Params(":uid"))

	if err != nil {
		return toFolderError(err)
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	canAdmin, err := g.CanAdmin()
	if err != nil {
		return toFolderError(err)
	}

	if !canAdmin {
		return toFolderError(models.ErrFolderAccessDenied)
	}

	cmd := models.UpdateDashboardAclCommand{}
	cmd.DashboardId = folder.Id

	for _, item := range apiCmd.Items {
		cmd.Items = append(cmd.Items, &models.DashboardAcl{
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

	cmd.Items, err = g.AddHiddenPermissions(cmd.Items, hs.Cfg)
	if err != nil {
		return Error(500, "Error while retrieving hidden permissions", err)
	}

	if okToUpdate, err := g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, cmd.Items); err != nil || !okToUpdate {
		if err != nil {
			if err == guardian.ErrGuardianPermissionExists ||
				err == guardian.ErrGuardianOverride {
				return Error(400, err.Error(), err)
			}

			return Error(500, "Error while checking folder permissions", err)
		}

		return Error(403, "Cannot remove own admin permission for a folder", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrDashboardAclInfoMissing {
			err = models.ErrFolderAclInfoMissing
		}
		if err == models.ErrDashboardPermissionDashboardEmpty {
			err = models.ErrFolderPermissionFolderEmpty
		}

		if err == models.ErrFolderAclInfoMissing || err == models.ErrFolderPermissionFolderEmpty {
			return Error(409, err.Error(), err)
		}

		return Error(500, "Failed to create permission", err)
	}

	return JSON(200, util.DynMap{
		"message": "Folder permissions updated",
		"id":      folder.Id,
		"title":   folder.Title,
	})
}

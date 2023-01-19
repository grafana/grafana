package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /folders/{folder_uid}/permissions folder_permissions getFolderPermissionList
//
// Gets all existing permissions for the folder with the given `uid`.
//
// Responses:
// 200: getFolderPermissionListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetFolderPermissionList(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.OrgID, UID: &uid, SignedInUser: c.SignedInUser})

	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g, err := guardian.New(c.Req.Context(), folder.ID, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return apierrors.ToFolderErrorResponse(dashboards.ErrFolderAccessDenied)
	}

	acl, err := g.GetACL()
	if err != nil {
		return response.Error(500, "Failed to get folder permissions", err)
	}

	filteredACLs := make([]*models.DashboardACLInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if perm.UserId > 0 && dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.FolderId = folder.ID
		perm.DashboardId = 0

		perm.UserAvatarUrl = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamId > 0 {
			perm.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}

		if perm.Slug != "" {
			perm.Url = dashboards.GetDashboardFolderURL(perm.IsFolder, perm.Uid, perm.Slug)
		}

		filteredACLs = append(filteredACLs, perm)
	}

	return response.JSON(http.StatusOK, filteredACLs)
}

// swagger:route POST /folders/{folder_uid}/permissions folder_permissions updateFolderPermissions
//
// Updates permissions for a folder. This operation will remove existing permissions if they’re not included in the request.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) UpdateFolderPermissions(c *models.ReqContext) response.Response {
	apiCmd := dtos.UpdateDashboardACLCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if err := validatePermissionsUpdate(apiCmd); err != nil {
		return response.Error(400, err.Error(), err)
	}

	uid := web.Params(c.Req)[":uid"]
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.OrgID, UID: &uid, SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g, err := guardian.New(c.Req.Context(), folder.ID, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	canAdmin, err := g.CanAdmin()
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	if !canAdmin {
		return apierrors.ToFolderErrorResponse(dashboards.ErrFolderAccessDenied)
	}

	items := make([]*models.DashboardACL, 0, len(apiCmd.Items))
	for _, item := range apiCmd.Items {
		items = append(items, &models.DashboardACL{
			OrgID:       c.OrgID,
			DashboardID: folder.ID,
			UserID:      item.UserID,
			TeamID:      item.TeamID,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	hiddenACL, err := g.GetHiddenACL(hs.Cfg)
	if err != nil {
		return response.Error(500, "Error while retrieving hidden permissions", err)
	}
	items = append(items, hiddenACL...)

	if okToUpdate, err := g.CheckPermissionBeforeUpdate(models.PERMISSION_ADMIN, items); err != nil || !okToUpdate {
		if err != nil {
			if errors.Is(err, guardian.ErrGuardianPermissionExists) ||
				errors.Is(err, guardian.ErrGuardianOverride) {
				return response.Error(400, err.Error(), err)
			}

			return response.Error(500, "Error while checking folder permissions", err)
		}

		return response.Error(403, "Cannot remove own admin permission for a folder", nil)
	}

	if !hs.AccessControl.IsDisabled() {
		old, err := g.GetACL()
		if err != nil {
			return response.Error(500, "Error while checking dashboard permissions", err)
		}
		if err := hs.updateDashboardAccessControl(c.Req.Context(), c.OrgID, folder.UID, true, items, old); err != nil {
			return response.Error(500, "Failed to create permission", err)
		}
		return response.Success("Dashboard permissions updated")
	}

	if err := hs.DashboardService.UpdateDashboardACL(c.Req.Context(), folder.ID, items); err != nil {
		if errors.Is(err, models.ErrDashboardACLInfoMissing) {
			err = models.ErrFolderACLInfoMissing
		}
		if errors.Is(err, models.ErrDashboardPermissionDashboardEmpty) {
			err = models.ErrFolderPermissionFolderEmpty
		}

		if errors.Is(err, models.ErrFolderACLInfoMissing) || errors.Is(err, models.ErrFolderPermissionFolderEmpty) {
			return response.Error(409, err.Error(), err)
		}

		return response.Error(500, "Failed to create permission", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Folder permissions updated",
		"id":      folder.ID,
		"title":   folder.Title,
	})
}

// swagger:parameters getFolderPermissionList
type GetFolderPermissionListParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
}

// swagger:parameters updateFolderPermissions
type UpdateFolderPermissionsParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
	// in:body
	// required:true
	Body dtos.UpdateDashboardACLCommand
}

// swagger:response getFolderPermissionListResponse
type GetFolderPermissionsResponse struct {
	// in: body
	Body []*models.DashboardACLInfoDTO `json:"body"`
}

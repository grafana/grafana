package api

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
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
func (hs *HTTPServer) GetFolderPermissionList(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.GetOrgID(), UID: &uid, SignedInUser: c.SignedInUser})

	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	acl, err := hs.getFolderACL(c.Req.Context(), c.SignedInUser, folder)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get folder permissions", err)
	}

	filteredACLs := make([]*dashboards.DashboardACLInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if perm.UserID > 0 && dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetFolderPermissionList).Inc()
		// nolint:staticcheck
		perm.FolderID = folder.ID
		perm.DashboardID = 0

		perm.UserAvatarURL = dtos.GetGravatarUrl(hs.Cfg, perm.UserEmail)

		if perm.TeamID > 0 {
			perm.TeamAvatarURL = dtos.GetGravatarUrlWithDefault(hs.Cfg, perm.TeamEmail, perm.Team)
		}

		if perm.Slug != "" {
			perm.URL = dashboards.GetDashboardFolderURL(perm.IsFolder, perm.UID, perm.Slug)
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
func (hs *HTTPServer) UpdateFolderPermissions(c *contextmodel.ReqContext) response.Response {
	apiCmd := dtos.UpdateDashboardACLCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if err := validatePermissionsUpdate(apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, err.Error(), err)
	}

	uid := web.Params(c.Req)[":uid"]
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.GetOrgID(), UID: &uid, SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	items := make([]*dashboards.DashboardACL, 0, len(apiCmd.Items))
	for _, item := range apiCmd.Items {
		items = append(items, &dashboards.DashboardACL{
			OrgID:       c.GetOrgID(),
			DashboardID: folder.ID, // nolint:staticcheck
			UserID:      item.UserID,
			TeamID:      item.TeamID,
			Role:        item.Role,
			Permission:  item.Permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.UpdateFolderPermissions).Inc()
	}

	acl, err := hs.getFolderACL(c.Req.Context(), c.SignedInUser, folder)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error while checking folder permissions", err)
	}

	items = append(items, hs.filterHiddenACL(c.SignedInUser, acl)...)

	if err := hs.updateDashboardAccessControl(c.Req.Context(), c.GetOrgID(), folder.UID, true, items, acl); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create permission", err)
	}

	return response.Success("Folder permissions updated")
}

var folderPermissionMap = map[string]dashboardaccess.PermissionType{
	"View":  dashboardaccess.PERMISSION_VIEW,
	"Edit":  dashboardaccess.PERMISSION_EDIT,
	"Admin": dashboardaccess.PERMISSION_ADMIN,
}

func (hs *HTTPServer) getFolderACL(ctx context.Context, user identity.Requester, folder *folder.Folder) ([]*dashboards.DashboardACLInfoDTO, error) {
	permissions, err := hs.folderPermissionsService.GetPermissions(ctx, user, folder.UID)
	if err != nil {
		return nil, err
	}

	acl := make([]*dashboards.DashboardACLInfoDTO, 0, len(permissions))
	for _, p := range permissions {
		if !p.IsManaged {
			continue
		}

		var role *org.RoleType
		if p.BuiltInRole != "" {
			tmp := org.RoleType(p.BuiltInRole)
			role = &tmp
		}

		permission := folderPermissionMap[hs.folderPermissionsService.MapActions(p)]

		acl = append(acl, &dashboards.DashboardACLInfoDTO{
			OrgID:          folder.OrgID,
			DashboardID:    folder.ID, // nolint:staticcheck
			FolderUID:      folder.ParentUID,
			Created:        p.Created,
			Updated:        p.Updated,
			UserID:         p.UserID,
			UserUID:        p.UserUID,
			UserLogin:      p.UserLogin,
			UserEmail:      p.UserEmail,
			TeamID:         p.TeamID,
			TeamUID:        p.TeamUID,
			TeamEmail:      p.TeamEmail,
			Team:           p.Team,
			Role:           role,
			Permission:     permission,
			PermissionName: permission.String(),
			UID:            folder.UID,
			Title:          folder.Title,
			URL:            folder.WithURL().URL,
			IsFolder:       true,
			Inherited:      false,
		})
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetFolderPermissionList).Inc()
	}

	return acl, nil
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
	Body []*dashboards.DashboardACLInfoDTO `json:"body"`
}

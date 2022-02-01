package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetDashboardPermissionList(c *models.ReqContext) response.Response {
	dashID, err := strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
	}

	_, rsp := getDashboardHelper(c.Req.Context(), c.OrgId, dashID, "")
	if rsp != nil {
		return rsp
	}

	g := guardian.New(c.Req.Context(), dashID, c.OrgId, c.SignedInUser)

	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	acl, err := g.GetACLWithoutDuplicates()
	if err != nil {
		return response.Error(500, "Failed to get dashboard permissions", err)
	}

	filteredAcls := make([]*models.DashboardAclInfoDTO, 0, len(acl))
	for _, perm := range acl {
		if perm.UserId > 0 && dtos.IsHiddenUser(perm.UserLogin, c.SignedInUser, hs.Cfg) {
			continue
		}

		perm.UserAvatarUrl = dtos.GetGravatarUrl(perm.UserEmail)

		if perm.TeamId > 0 {
			perm.TeamAvatarUrl = dtos.GetGravatarUrlWithDefault(perm.TeamEmail, perm.Team)
		}
		if perm.Slug != "" {
			perm.Url = models.GetDashboardFolderUrl(perm.IsFolder, perm.Uid, perm.Slug)
		}

		filteredAcls = append(filteredAcls, perm)
	}

	return response.JSON(200, filteredAcls)
}

func (hs *HTTPServer) UpdateDashboardPermissions(c *models.ReqContext) response.Response {
	apiCmd := dtos.UpdateDashboardAclCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if err := validatePermissionsUpdate(apiCmd); err != nil {
		return response.Error(400, err.Error(), err)
	}

	dashID, err := strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
	}

	dash, rsp := getDashboardHelper(c.Req.Context(), c.OrgId, dashID, "")
	if rsp != nil {
		return rsp
	}

	g := guardian.New(c.Req.Context(), dashID, c.OrgId, c.SignedInUser)
	if canAdmin, err := g.CanAdmin(); err != nil || !canAdmin {
		return dashboardGuardianResponse(err)
	}

	var items []*models.DashboardAcl
	for _, item := range apiCmd.Items {
		items = append(items, &models.DashboardAcl{
			OrgID:       c.OrgId,
			DashboardID: dashID,
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
			if errors.Is(err, guardian.ErrGuardianPermissionExists) || errors.Is(err, guardian.ErrGuardianOverride) {
				return response.Error(400, err.Error(), err)
			}

			return response.Error(500, "Error while checking dashboard permissions", err)
		}

		return response.Error(403, "Cannot remove own admin permission for a folder", nil)
	}

	if hs.Features.IsEnabled(featuremgmt.FlagAccesscontrol) {
		old, err := g.GetAcl()
		if err != nil {
			return response.Error(500, "Error while checking dashboard permissions", err)
		}
		if err := hs.updateDashboardAccessControl(c.Req.Context(), dash.OrgId, dash.Id, false, items, old); err != nil {
			return response.Error(500, "Failed to create permission", err)
		}
		return response.Success("Dashboard permissions updated")
	}

	if err := updateDashboardACL(c.Req.Context(), hs.SQLStore, dashID, items); err != nil {
		if errors.Is(err, models.ErrDashboardAclInfoMissing) ||
			errors.Is(err, models.ErrDashboardPermissionDashboardEmpty) {
			return response.Error(409, err.Error(), err)
		}
		return response.Error(500, "Failed to create permission", err)
	}

	return response.Success("Dashboard permissions updated")
}

// updateDashboardAccessControl is used for api backward compatability
func (hs *HTTPServer) updateDashboardAccessControl(ctx context.Context, orgID, dashID int64, isFolder bool, items []*models.DashboardAcl, old []*models.DashboardAclInfoDTO) error {
	svc := hs.dashboardPermissionsService
	if isFolder {
		svc = hs.folderPermissionsService
	}

	for _, item := range items {
		resourceID := strconv.FormatInt(dashID, 10)
		permissions := item.Permission.String()
		if item.UserID != 0 {
			_, err := svc.SetUserPermission(ctx, orgID, item.UserID, resourceID, permissions)
			if err != nil {
				return err
			}
		} else if item.TeamID != 0 {
			_, err := svc.SetTeamPermission(ctx, orgID, item.TeamID, resourceID, permissions)
			if err != nil {
				return err
			}
		} else if item.Role != nil {
			_, err := svc.SetBuiltInRolePermission(ctx, orgID, string(*item.Role), resourceID, permissions)
			if err != nil {
				return err
			}
		}
	}

	for _, o := range old {
		shouldRemove := true
		for _, item := range items {
			if item.UserID != 0 && item.UserID == o.UserId {
				shouldRemove = false
				break
			}
			if item.TeamID != 0 && item.TeamID == o.TeamId {
				shouldRemove = false
				break
			}
			if item.Role != nil && item.Role == o.Role {
				shouldRemove = false
				break
			}
		}
		if shouldRemove {
			resourceID := strconv.FormatInt(dashID, 10)
			if o.UserId != 0 {
				_, err := svc.SetUserPermission(ctx, orgID, o.UserId, resourceID, "")
				if err != nil {
					return err
				}
			} else if o.TeamId != 0 {
				_, err := svc.SetTeamPermission(ctx, orgID, o.TeamId, resourceID, "")
				if err != nil {
					return err
				}
			} else if o.Role != nil {
				_, err := svc.SetBuiltInRolePermission(ctx, orgID, string(*o.Role), resourceID, "")
				if err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func validatePermissionsUpdate(apiCmd dtos.UpdateDashboardAclCommand) error {
	for _, item := range apiCmd.Items {
		if item.UserID > 0 && item.TeamID > 0 {
			return models.ErrPermissionsWithUserAndTeamNotAllowed
		}

		if (item.UserID > 0 || item.TeamID > 0) && item.Role != nil {
			return models.ErrPermissionsWithRoleNotAllowed
		}
	}
	return nil
}

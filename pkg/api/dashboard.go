package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	"github.com/grafana/grafana/pkg/api/bmc/localization"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/bhdcodes"

	"github.com/grafana/grafana/pkg/api/bmc"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/bmc/audit"
	"github.com/grafana/grafana/pkg/components/dashdiffs"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/dashboardversion/dashverimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/prefapi"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

const (
	anonString = "Anonymous"
)

func (hs *HTTPServer) isDashboardStarredByUser(c *contextmodel.ReqContext, dashID int64) (bool, error) {
	ctx, span := tracer.Start(c.Req.Context(), "api.isDashboardStarredByUser")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	if !c.IsSignedIn {
		return false, nil
	}

	if !c.SignedInUser.IsIdentityType(claims.TypeUser) {
		return false, nil
	}

	userID, err := c.SignedInUser.GetInternalID()
	if err != nil {
		return false, err
	}

	query := star.IsStarredByUserQuery{UserID: userID, DashboardID: dashID}
	return hs.starService.IsStarredByUser(c.Req.Context(), &query)
}

func dashboardGuardianResponse(err error) response.Response {
	if err != nil {
		var dashboardErr dashboards.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, "Error while checking dashboard permissions", err)
	}
	return response.Error(http.StatusForbidden, "Access denied to this dashboard", nil)
}

// swagger:route GET /dashboards/uid/{uid} dashboards getDashboardByUID
//
// Get dashboard by uid.
//
// Will return the dashboard given the dashboard unique identifier (uid).
//
// Responses:
// 200: dashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 406: notAcceptableError
// 500: internalServerError
//
//nolint:gocyclo
func (hs *HTTPServer) GetDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]
	dash, rsp := hs.getDashboardHelper(ctx, c.SignedInUser.GetOrgID(), 0, uid)
	if rsp != nil {
		return rsp
	}

	// v2 is not supported in /api
	if strings.HasPrefix(dash.APIVersion, "v2") {
		url := fmt.Sprintf("/apis/dashboard.grafana.app/%s/namespaces/%s/dashboards/%s", dash.APIVersion, hs.namespacer(c.SignedInUser.GetOrgID()), dash.UID)
		return response.Error(http.StatusNotAcceptable, "dashboard api version not supported, use "+url+" instead", nil)
	}

	var (
		publicDashboardEnabled = false
		err                    error
	)

	// If public dashboards is enabled and we have a public dashboard, update meta values
	if hs.Cfg.PublicDashboardsEnabled {
		publicDashboard, err := hs.PublicDashboardsApi.PublicDashboardService.FindByDashboardUid(ctx, c.SignedInUser.GetOrgID(), dash.UID)
		if err != nil && !errors.Is(err, publicdashboardModels.ErrPublicDashboardNotFound) {
			return response.Error(http.StatusInternalServerError, "Error while retrieving public dashboards", err)
		}

		if publicDashboard != nil && (hs.License.FeatureEnabled(publicdashboardModels.FeaturePublicDashboardsEmailSharing) || publicDashboard.Share != publicdashboardModels.EmailShareType) {
			publicDashboardEnabled = publicDashboard.IsEnabled
		}
	}

	// When dash contains only keys id, uid that means dashboard data is not valid and json decode failed.
	if dash.Data != nil {
		isEmptyData := true
		for k := range dash.Data.MustMap() {
			if k != "id" && k != "uid" {
				isEmptyData = false
				break
			}
		}
		if isEmptyData {
			return response.Error(http.StatusInternalServerError, "Error while loading dashboard, dashboard data is invalid", nil)
		}

		// the dashboard id is no longer set in the spec for unified storage, set it here to keep api compatibility
		if dash.Data.Get("id").MustString() == "" {
			dash.Data.Set("id", dash.ID)
		}
	}
	guardian, err := guardian.NewByDashboard(ctx, dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canView, err := guardian.CanView(); err != nil || !canView {
		return dashboardGuardianResponse(err)
	}
	canEdit, _ := guardian.CanEdit()
	canSave, _ := guardian.CanSave()
	canAdmin, _ := guardian.CanAdmin()
	canDelete, _ := guardian.CanDelete()

	isStarred, err := hs.isDashboardStarredByUser(c, dash.ID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error while checking if dashboard was starred by user", err)
	}
	// Finding creator and last updater of the dashboard
	updater, creator := anonString, anonString
	if dash.UpdatedBy > 0 {
		updater = hs.getIdentityName(ctx, dash.OrgID, dash.UpdatedBy)
	}
	if dash.CreatedBy > 0 {
		creator = hs.getIdentityName(ctx, dash.OrgID, dash.CreatedBy)
	}

	annotationPermissions := &dashboardsV0.AnnotationPermission{}
	if hs.Features.IsEnabled(ctx, featuremgmt.FlagAnnotationPermissionUpdate) {
		hs.getAnnotationPermissionsByScope(c, &annotationPermissions.Dashboard, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID))
	} else {
		hs.getAnnotationPermissionsByScope(c, &annotationPermissions.Dashboard, accesscontrol.ScopeAnnotationsTypeDashboard)
	}
	hs.getAnnotationPermissionsByScope(c, &annotationPermissions.Organization, accesscontrol.ScopeAnnotationsTypeOrganization)

	meta := dtos.DashboardMeta{
		IsStarred:              isStarred,
		Slug:                   dash.Slug,
		Type:                   dashboards.DashTypeDB,
		CanStar:                c.IsSignedIn,
		CanSave:                canSave,
		CanEdit:                canEdit,
		CanAdmin:               canAdmin,
		CanDelete:              canDelete,
		Created:                dash.Created,
		Updated:                dash.Updated,
		UpdatedBy:              updater,
		CreatedBy:              creator,
		Version:                dash.Version,
		APIVersion:             dash.APIVersion,
		HasACL:                 dash.HasACL,
		IsFolder:               dash.IsFolder,
		FolderId:               dash.FolderID, // nolint:staticcheck
		Url:                    dash.GetURL(),
		FolderTitle:            "General",
		AnnotationsPermissions: annotationPermissions,
		PublicDashboardEnabled: publicDashboardEnabled,
	}
	metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetDashboard).Inc()
	// lookup folder title & url
	if dash.FolderUID != "" && hs.Features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		queryResult, err := hs.folderService.Get(ctx, &folder.GetFolderQuery{
			OrgID:        c.SignedInUser.GetOrgID(),
			UID:          &dash.FolderUID,
			SignedInUser: c.SignedInUser,
		})
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return response.Error(http.StatusNotFound, "Folder not found", err)
		}
		if apierrors.IsForbidden(err) {
			// the dashboard is in a folder the user can't access, so return the dashboard without folder info
			err = nil
			queryResult = &folder.Folder{
				UID: dash.FolderUID,
			}
		}
		if err != nil {
			hs.log.Error("Failed to get dashboard folder", "error", err)
			return response.Error(http.StatusInternalServerError, "Dashboard folder could not be read", err)
		}

		meta.FolderUid = queryResult.UID
		meta.FolderTitle = queryResult.Title
		meta.FolderId = queryResult.ID // nolint:staticcheck
		queryResult = queryResult.WithURL()
		meta.FolderUrl = queryResult.URL
	} else if dash.FolderID > 0 { // nolint:staticcheck
		query := dashboards.GetDashboardQuery{ID: dash.FolderID, OrgID: c.SignedInUser.GetOrgID()} // nolint:staticcheck
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetDashboard).Inc()
		queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return response.Error(http.StatusNotFound, "Folder not found", err)
			}
			return response.Error(http.StatusInternalServerError, "Dashboard folder could not be read", err)
		}
		meta.FolderUid = queryResult.UID
		meta.FolderTitle = queryResult.Title
		meta.FolderUrl = queryResult.GetURL()
	}

	provisioningData, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardID(ctx, dash.ID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error while checking if dashboard is provisioned", err)
	}

	if provisioningData != nil {
		allowUIUpdate := hs.ProvisioningService.GetAllowUIUpdatesFromConfig(provisioningData.Name)
		if !allowUIUpdate {
			meta.Provisioned = true
		}

		meta.ProvisionedExternalId, err = filepath.Rel(
			hs.ProvisioningService.GetDashboardProvisionerResolvedPath(provisioningData.Name),
			provisioningData.ExternalID,
		)
		if err != nil {
			// Not sure when this could happen so not sure how to better handle this. Right now ProvisionedExternalId
			// is for better UX, showing in Save/Delete dialogs and so it won't break anything if it is empty.
			hs.log.Warn("Failed to create ProvisionedExternalId", "err", err)
		}
	}

	// make sure db version is in sync with json model version
	dash.Data.Set("version", dash.Version)

	dto := dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta:      meta,
	}

	c.TimeRequest(metrics.MApiDashboardGet)

	// BMC Changes - Will check for user dash personalization and apply it if found
	bmc.SetupCustomPersonalization(hs.sqlStore, c.Req.Context(), &dto, c.OrgID, c.UserID, uid)
	// BMC Changes - End

	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) getAnnotationPermissionsByScope(c *contextmodel.ReqContext, actions *dashboardsV0.AnnotationActions, scope string) {
	ctx, span := tracer.Start(c.Req.Context(), "api.getAnnotationPermissionsByScope")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var err error

	evaluate := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, scope)
	actions.CanAdd, err = hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluate)
	if err != nil {
		hs.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsCreate, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, scope)
	actions.CanDelete, err = hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluate)
	if err != nil {
		hs.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsDelete, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsWrite, scope)
	actions.CanEdit, err = hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluate)
	if err != nil {
		hs.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsWrite, "scope", scope)
	}
}

// getIdentityName returns name of either user or service account
func (hs *HTTPServer) getIdentityName(ctx context.Context, orgID, id int64) string {
	ctx, span := tracer.Start(ctx, "api.getIdentityName")
	defer span.End()

	// We use GetSignedInUser here instead of GetByID so both user and service accounts are resolved.
	ident, err := hs.userService.GetSignedInUser(ctx, &user.GetSignedInUserQuery{
		UserID: id,
		OrgID:  orgID,
	})
	if err != nil {
		return anonString
	}

	if ident.IsIdentityType(claims.TypeServiceAccount) {
		return ident.GetName()
	}
	return ident.GetLogin()
}

func (hs *HTTPServer) getDashboardHelper(ctx context.Context, orgID int64, id int64, uid string) (*dashboards.Dashboard, response.Response) {
	ctx, span := hs.tracer.Start(ctx, "api.getDashboardHelper")
	defer span.End()

	var query dashboards.GetDashboardQuery

	if len(uid) > 0 {
		query = dashboards.GetDashboardQuery{UID: uid, ID: id, OrgID: orgID}
	} else {
		query = dashboards.GetDashboardQuery{ID: id, OrgID: orgID}
	}

	queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
	if err != nil {
		return nil, response.Error(http.StatusNotFound, "Dashboard not found", err)
	}

	return queryResult, nil
}

// swagger:route PATCH /dashboards/uid/{uid}/trash dashboards restoreDeletedDashboardByUID
//
// Restore a dashboard to a given dashboard version using UID.
//
// Responses:
// 200: postDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RestoreDeletedDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.RestoreDeletedDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]
	cmd := dashboards.RestoreDeletedDashboardCommand{}

	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while restoring deleted dashboard", err)
	}

	dash, err := hs.DashboardService.GetSoftDeletedDashboard(c.Req.Context(), c.SignedInUser.GetOrgID(), uid)
	if err != nil {
		return response.Error(http.StatusNotFound, "Dashboard not found", err)
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canRestore, err := guardian.CanSave(); err != nil || !canRestore {
		return dashboardGuardianResponse(err)
	}

	err = hs.DashboardService.RestoreDashboard(c.Req.Context(), dash, c.SignedInUser, cmd.FolderUID)
	if err != nil {

		// BMC CODE STARTS
		go audit.RestoreDeletedDashboardAudit(c, dash, err)
		// BMC CODE ENDS

		var dashboardErr dashboards.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, "Dashboard cannot be restored", err)
	}

	// BMC CODE STARTS
	go audit.RestoreDeletedDashboardAudit(c, dash, nil)
	// BMC CODE ENDS

	return response.JSON(http.StatusOK, util.DynMap{
		"title":   dash.Title,
		"message": fmt.Sprintf("Dashboard %s restored", dash.Title),
		"uid":     dash.UID,
	})
}

// SoftDeleteDashboard swagger:route DELETE /dashboards/uid/{uid} dashboards deleteDashboardByUID
//
// Delete dashboard by uid.
//
// Will delete the dashboard given the specified unique identifier (uid).
//
// Responses:
// 200: deleteDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) SoftDeleteDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.SoftDeleteDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]
	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), 0, uid)
	if rsp != nil {
		return rsp
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canDelete, err := guardian.CanDelete(); err != nil || !canDelete {
		return dashboardGuardianResponse(err)
	}

	err = hs.DashboardService.SoftDeleteDashboard(c.Req.Context(), c.SignedInUser.GetOrgID(), uid)
	if err != nil {

		// BMC CODE STARTS
		go func() {
			// Audit log
			audit.DashboardSoftDeleteAudit(c, err, dash)
			checkFFandDeleteCache(c, uid)
		}()
		// BMC CODE ENDS

		var dashboardErr dashboards.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if errors.Is(err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard) {
				return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
			}
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete dashboard", err)
	}

	// BMC CODE STARTS
	go func() {
		// Audit log
		audit.DashboardSoftDeleteAudit(c, nil, dash)
		checkFFandDeleteCache(c, uid)
	}()
	// BMC CODE ENDS

	return response.JSON(http.StatusOK, util.DynMap{
		"title":   dash.Title,
		"message": fmt.Sprintf("Dashboard %s moved to Recently deleted", dash.Title),
		"uid":     dash.UID,
	})
}

// DeleteDashboardByUID swagger:route DELETE /dashboards/uid/{uid} dashboards deleteDashboardByUID
//
// Delete dashboard by uid.
//
// Will delete the dashboard given the specified unique identifier (uid).
//
// Responses:
// 200: deleteDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteDashboardByUID(c *contextmodel.ReqContext) response.Response {
	return hs.deleteDashboard(c)
}

// HardDeleteDashboardByUID swagger:route DELETE /dashboards/uid/{uid}/trash dashboards hardDeleteDashboardByUID
//
// Hard delete dashboard by uid.
//
// Will delete the dashboard given the specified unique identifier (uid).
//
// Responses:
// 200: deleteDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) HardDeleteDashboardByUID(c *contextmodel.ReqContext) response.Response {
	return hs.deleteDashboard(c)
}

func (hs *HTTPServer) deleteDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.deleteDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]

	var dash *dashboards.Dashboard
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		var err error
		dash, err = hs.DashboardService.GetSoftDeletedDashboard(c.Req.Context(), c.SignedInUser.GetOrgID(), uid)
		if err != nil {
			return response.Error(http.StatusNotFound, "Dashboard not found", err)
		}
	} else {
		var rsp response.Response
		dash, rsp = hs.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), 0, web.Params(c.Req)[":uid"])
		if rsp != nil {
			return rsp
		}
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canDelete, err := guardian.CanDelete(); err != nil || !canDelete {
		return dashboardGuardianResponse(err)
	}

	if dash.IsFolder {
		return response.Error(http.StatusBadRequest, "Use folders endpoint for deleting folders.", nil)
	}

	// disconnect all library elements for this dashboard
	err = hs.LibraryElementService.DisconnectElementsFromDashboard(c.Req.Context(), dash.ID)
	if err != nil {
		hs.log.Error(
			"Failed to disconnect library elements",
			"dashboard", dash.ID,
			"identity", c.GetID(),
			"error", err)
	}

	err = hs.DashboardService.DeleteDashboard(c.Req.Context(), dash.ID, dash.UID, c.SignedInUser.GetOrgID())
	if err != nil {

		// BMC CODE STARTS
		go func() {
			// audit log
			audit.DashboardDeleteAudit(c, err, dash)
			checkFFandDeleteCache(c, uid)
		}()
		// BMC CODE ENDS

		var dashboardErr dashboards.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if errors.Is(err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard) {
				return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
			}
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete dashboard", err)
	}

	if hs.Live != nil {
		err := hs.Live.GrafanaScope.Dashboards.DashboardDeleted(c.SignedInUser.GetOrgID(), c.SignedInUser, dash.UID)
		if err != nil {
			hs.log.Error("Failed to broadcast delete info", "dashboard", dash.UID, "error", err)
		}
	}

	// BMC CODE STARTS
	go func() {
		// audit log
		audit.DashboardDeleteAudit(c, nil, dash)
		// delete variable cache of these dashboards from redis
		checkFFandDeleteCache(c, uid)
	}()
	// BMC CODE ENDS

	return response.JSON(http.StatusOK, util.DynMap{
		"title":   dash.Title,
		"message": fmt.Sprintf("Dashboard %s deleted", dash.Title),
		"uid":     dash.UID,
	})
}

// swagger:route POST /dashboards/db dashboards postDashboard
//
// Create / Update dashboard
//
// Creates a new dashboard or updates an existing dashboard.
// Note: This endpoint is not intended for creating folders, use `POST /api/folders` for that.
//
// Responses:
// 200: postDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 412: preconditionFailedError
// 422: unprocessableEntityError
// 500: internalServerError
func (hs *HTTPServer) PostDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.PostDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	cmd := dashboards.SaveDashboardCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		//BMC code change
		return response.Error(http.StatusBadRequest, "bad request data when creating or updating dashboard", err)
	}
	return hs.postDashboard(c, cmd)
}

func (hs *HTTPServer) postDashboard(c *contextmodel.ReqContext, cmd dashboards.SaveDashboardCommand) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.postDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	if cmd.IsFolder {
		return response.Error(http.StatusBadRequest, "Use folders endpoint for saving folders.", nil)
	}

	ctx = c.Req.Context()
	var err error

	var userID int64
	if id, err := identity.UserIdentifier(c.SignedInUser.GetID()); err == nil {
		userID = id
	}

	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.UserID = userID

	dash := cmd.GetDashboardModel()

	// BMC Change: Next line
	localesJson := hs.getLocalesJson(dash.Data)

	//BMC CODE STARTS
	hs.log.Info("TenantId:", c.SignedInUser.GetOrgID(), " About to authenticate SQL permissions")
	if !isRbacSqlEnabled(c, hs) {
		hs.log.Debug("TenantId:", c.SignedInUser.GetOrgID(), " User does not have SQL permissions. Verifying if SQL query has been modified.")
		var existingDashboard *dashboards.Dashboard
		var rsp response.Response
		dashboardUID := dash.UID

		// Check if this is an update (based on the UID)
		if dashboardUID != "" {
			hs.log.Debug(
				"TenantId:", c.SignedInUser.GetOrgID(),
				" Dashboard has UID, attempting to load existing dashboard",
				" UID:", dashboardUID,
			)
			//load the existing dashboard
			existingDashboard, rsp = hs.getDashboardHelper(ctx, c.SignedInUser.GetOrgID(), 0, dashboardUID)
			if rsp != nil {
				hs.log.Debug("TenantId:", c.SignedInUser.GetOrgID(), " Error fetching existing dashboard")
				return rsp // should we do this? return if there's an error or failure to find the dashboard?
			}
			hs.log.Debug("TenantId:", c.SignedInUser.GetOrgID(), " Existing dashboard loaded successfully", "UID", dashboardUID)
		} else {
			existingDashboard = nil
			hs.log.Debug("TenantId:", c.SignedInUser.GetOrgID(), " No UID found, assuming this is a new dashboard")
		}

		// RBAC for SQL
		if existingDashboard == nil {
			// Enforcing SQL restrictions on a new dashboard.
			err = enforceSQLRestrictions(dash.Data, nil)
		} else {
			// Enforce SQL restrictions on existing dashboard
			err = enforceSQLRestrictions(dash.Data, existingDashboard.Data)
		}

		if err != nil {
			hs.log.Warn("TenantId:", c.SignedInUser.GetOrgID(), " SQL restriction enforcement failed", "error", err.Error())
			return response.Error(http.StatusForbidden, err.Error(), nil)
		}
		hs.log.Debug("TenantId:", c.SignedInUser.GetOrgID(), " SQL query restrictions passed")
	}
	//BMC CODE ENDS

	newDashboard := dash.ID == 0
	if newDashboard {
		limitReached, err := hs.QuotaService.QuotaReached(c, dashboards.QuotaTargetSrv)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to get quota", err)
		}
		if limitReached {
			return response.Error(http.StatusForbidden, "Quota reached", nil)
		}
	}

	var provisioningData *dashboards.DashboardProvisioning
	if dash.ID != 0 {
		data, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardID(c.Req.Context(), dash.ID)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Error while checking if dashboard is provisioned", err)
		}
		provisioningData = data
	} else if dash.UID != "" {
		data, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardUID(c.Req.Context(), dash.OrgID, dash.UID)
		if err != nil && !errors.Is(err, dashboards.ErrProvisionedDashboardNotFound) && !errors.Is(err, dashboards.ErrDashboardNotFound) {
			return response.Error(http.StatusInternalServerError, "Error while checking if dashboard is provisioned", err)
		}
		provisioningData = data
	}

	allowUiUpdate := true
	if provisioningData != nil {
		allowUiUpdate = hs.ProvisioningService.GetAllowUIUpdatesFromConfig(provisioningData.Name)
	}

	dashItem := &dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   cmd.Message,
		OrgID:     c.SignedInUser.GetOrgID(),
		User:      c.SignedInUser,
		Overwrite: cmd.Overwrite,
	}

	dashboard, saveErr := hs.DashboardService.SaveDashboard(ctx, dashItem, allowUiUpdate)

	if hs.Live != nil {
		// Tell everyone listening that the dashboard changed
		if dashboard == nil {
			dashboard = dash // the original request
		}

		// This will broadcast all save requests only if a `gitops` observer exists.
		// gitops is useful when trying to save dashboards in an environment where the user can not save
		channel := hs.Live.GrafanaScope.Dashboards
		liveerr := channel.DashboardSaved(c.SignedInUser.GetOrgID(), c.SignedInUser, cmd.Message, dashboard, saveErr)

		// When an error exists, but the value broadcast to a gitops listener return 202
		if liveerr == nil && saveErr != nil && channel.HasGitOpsObserver(c.SignedInUser.GetOrgID()) {
			//BMC code change
			return response.JSON(http.StatusAccepted, util.DynMap{
				"status":  "pending",
				"message": "changes were broadcast to the gitops listener",
				"bhdCode": bhdcodes.DashboardGitOpsBroadcast,
			})
		}

		if liveerr != nil {
			hs.log.Warn("Unable to broadcast save event", "uid", dashboard.UID, "error", liveerr)
		}
	}

	if saveErr != nil {

		// BMC CODE STARTS
		if newDashboard {
			go audit.DashboardCreateAudit(c, dash, saveErr)
		} else {
			go audit.DashboardUpdateAudit(c, dash, saveErr)
		}
		// BMC CODE ENDS

		return apierrors.ToDashboardErrorResponse(ctx, hs.pluginStore, saveErr)
	}

	// BMC Change: Starts
	if external.FeatureFlagBHDLocalization.Enabled(c.Req, c.SignedInUser) {
		query := localization.Query{OrgID: c.OrgID, ResourceUID: dashboard.UID}
		localization.UpdateLocalesJSON(c.Req.Context(), hs.sqlStore.WithTransactionalDbSession, query, localesJson)
	}
	// BMC Change: Ends

	// Clear permission cache for the user who's created the dashboard, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	if newDashboard {
		hs.accesscontrolService.ClearUserPermissionCache(c.SignedInUser)
	}

	// connect library panels for this dashboard after the dashboard is stored and has an ID
	err = hs.LibraryPanelService.ConnectLibraryPanelsForDashboard(ctx, c.SignedInUser, dashboard)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error while connecting library panels", err)
	}

	c.TimeRequest(metrics.MApiDashboardSave)

	// BMC CODE STARTS
	if newDashboard {
		go audit.DashboardCreateAudit(c, dashboard, nil)
	} else {
		go audit.DashboardUpdateAudit(c, dashboard, nil)
	}
	// BMC CODE ENDS

	return response.JSON(http.StatusOK, util.DynMap{
		"status":    "success",
		"slug":      dashboard.Slug,
		"version":   dashboard.Version,
		"id":        dashboard.ID,
		"uid":       dashboard.UID,
		"url":       dashboard.GetURL(),
		"folderUid": dashboard.FolderUID,
	})
}

// BMC CODE STARTS
func enforceSQLRestrictions(newDashboardData *simplejson.Json, existingDashboardData *simplejson.Json) error {
	panels := newDashboardData.Get("panels").MustArray()

	for _, panel := range panels {
		panelObj := panel.(map[string]interface{})

		targets, ok := panelObj["targets"].([]interface{})
		if !ok {
			// Skip to the next panel object if "targets" is nil or not []interface{}
			continue
		}

		for _, target := range targets {
			targetObj := target.(map[string]interface{})

			if isSQLQueryJson(targetObj) {
				// Scenario: If this is a new dashboard (no existing dashboard), treat all SQL queries as newly added
				if existingDashboardData == nil {
					return fmt.Errorf("SQL is restricted for the current user.")
				}

				// Scenario: SQL query added in an existing dashboard
				if !existsInExistingDashboardJson(panelObj, targetObj, existingDashboardData) {
					return fmt.Errorf("SQL is restricted for the current user.")
				}

				// Scenario: SQL query modified in an existing dashboard
				existingTarget := getExistingTargetJson(panelObj, targetObj, existingDashboardData)
				if existingTarget != nil && getRawSQLQuery(targetObj) != getRawSQLQuery(existingTarget) {
					return fmt.Errorf("SQL is restricted for the current user.")
				}

				// Scenario: SQL query removed in an existing dashboard
				// Removal of target query is supported even if user doesnt have RBAC for SQL
			}
		}
	}
	return nil
}

// Method to check if the target is a SQL query
func isSQLQueryJson(target map[string]interface{}) bool {
	datasource, ok := target["datasource"].(map[string]interface{})
	if !ok {
		return false
	}

	sourceType, ok := target["sourceType"].(string)
	if !ok {
		return false
	}

	sourceQuery, ok := target["sourceQuery"].(map[string]interface{})
	if !ok {
		return false
	}

	queryType, ok := sourceQuery["queryType"].(string)
	if !ok {
		return false
	}

	return datasource["type"] == "bmchelix-ade-datasource" && sourceType == "remedy" && queryType == "SQL"
}

// get the SQL query from the target
func getRawSQLQuery(target map[string]interface{}) string {
	sourceQuery := target["sourceQuery"].(map[string]interface{})
	rawQuery := sourceQuery["rawQuery"].(string)
	return rawQuery
}

// Check if a panel with the target exists in the existing dashboard.
func existsInExistingDashboardJson(panel map[string]interface{}, target map[string]interface{}, existingDashboardData *simplejson.Json) bool {
	existingPanels := existingDashboardData.Get("panels").MustArray()

	for _, existingPanel := range existingPanels {
		existingPanelObj := existingPanel.(map[string]interface{})

		if existingPanelObj["id"] == panel["id"] {
			existingTargets := existingPanelObj["targets"].([]interface{})

			for _, existingTarget := range existingTargets {
				existingTargetObj := existingTarget.(map[string]interface{})
				if existingTargetObj["refId"] == target["refId"] && existingTargetObj["sourceQuery"].(map[string]interface{})["queryType"] == "SQL" {
					return true
				}
			}
		}
	}
	return false
}

// Get the existing target from the original dashboard for comparison.
func getExistingTargetJson(panel map[string]interface{}, target map[string]interface{}, existingDashboardData *simplejson.Json) map[string]interface{} {
	existingPanels := existingDashboardData.Get("panels").MustArray()

	for _, existingPanel := range existingPanels {
		existingPanelObj := existingPanel.(map[string]interface{})

		if existingPanelObj["id"] == panel["id"] {
			existingTargets := existingPanelObj["targets"].([]interface{})

			for _, existingTarget := range existingTargets {
				existingTargetObj := existingTarget.(map[string]interface{})
				if existingTargetObj["refId"] == target["refId"] {
					return existingTargetObj
				}
			}
		}
	}
	return nil
}

func isRbacSqlEnabled(c *contextmodel.ReqContext, hs *HTTPServer) bool {
	orgRole := c.SignedInUser.OrgRole
	isOrgAdmin := orgRole == org.RoleAdmin

	hs.log.Debug(fmt.Sprintf("TenantId: %v From isRbacSqlEnabled(), OrgRole: %v, isOrgAdmin: %v", c.SignedInUser.GetOrgID(), orgRole, isOrgAdmin))

	isSqlEnabledinDefaultPreferences, isAppliedToAdmins := getPreferences(c, hs)

	// If SQL is enabled in default preferences, return true immediately
	if isSqlEnabledinDefaultPreferences {
		return true
	}

	// If SQL is not enabled in default preferences, check:
	// 1. If applied to admins, return the RBAC value
	// 2. If the user is an OrgAdmin, allow SQL
	// 3. Otherwise, return the RBAC value
	if isAppliedToAdmins {
		return isSqlEnabledinRbac(c, hs)
	}

	return isOrgAdmin || isSqlEnabledinRbac(c, hs)
}

func getPreferences(c *contextmodel.ReqContext, hs *HTTPServer) (bool, bool) {
	// Log the request for preferences
	hs.log.Debug(fmt.Sprintf("TenantId: %d - Fetching preferences", c.SignedInUser.GetOrgID()))

	// Fetch preferences response
	preferencesResponse := prefapi.GetPreferencesFor(c.Req.Context(), hs.DashboardService, hs.preferenceService, c.SignedInUser.GetOrgID(), 0, 0)
	if preferencesResponse.Status() != 200 {
		hs.log.Error(fmt.Sprintf("TenantId: %d - Failed to fetch preferences, status: %d", c.SignedInUser.GetOrgID(), preferencesResponse.Status()))
		return false, false
	}
	hs.log.Debug(fmt.Sprintf("TenantId: %d - Preferences fetched successfully", c.SignedInUser.GetOrgID()))

	var preferencesData map[string]interface{}
	if err := json.Unmarshal(preferencesResponse.Body(), &preferencesData); err != nil {
		hs.log.Error(fmt.Sprintf("TenantId: %d - Failed to parse preferences data: %v", c.SignedInUser.GetOrgID(), err))
		return false, false
	}
	hs.log.Debug(fmt.Sprintf("TenantId: %d - Preferences parsed successfully", c.SignedInUser.GetOrgID()))

	// Check if preferencesData is empty
	if len(preferencesData) == 0 || preferencesData == nil {
		hs.log.Debug(fmt.Sprintf("TenantId: %d - Preferences data is empty", c.SignedInUser.GetOrgID()))
		return true, false
	}
	// Check if SQL is enabled in preferences
	enabledQueryTypesRaw, ok := preferencesData["enabledQueryTypes"].(map[string]interface{})
	if !ok || enabledQueryTypesRaw == nil {
		hs.log.Debug(fmt.Sprintf("TenantId: %d - Unable to retrieve enabledQueryTypes or it is nil", c.SignedInUser.GetOrgID()))
		return true, false
	}

	// Safely check for "enabledTypes" within "enabledQueryTypes"
	enabledTypes, ok := enabledQueryTypesRaw["enabledTypes"].([]interface{})
	if !ok || enabledTypes == nil {
		hs.log.Debug(fmt.Sprintf("TenantId: %d - Unable to retrieve enabledTypes in enabledQueryTypes or it is nil", c.SignedInUser.GetOrgID()))
		return true, false
	}

	isSqlEnabled := containsQueryType(hs, enabledTypes, "SQL", c)
	hs.log.Debug(fmt.Sprintf("TenantId: %d - isSqlEnabled in preferences: %v", c.SignedInUser.GetOrgID(), isSqlEnabled))

	// Check if SQL is applied to admins
	isAppliedForAdmin := false
	if applyForAdmin, ok := enabledQueryTypesRaw["applyForAdmin"].(bool); ok {
		isAppliedForAdmin = applyForAdmin
		hs.log.Debug(fmt.Sprintf("TenantId: %d - isAppliedForAdmin: %v", c.SignedInUser.GetOrgID(), isAppliedForAdmin))
	} else {
		hs.log.Debug(fmt.Sprintf("TenantId: %d - ApplyForAdmin not found in preferences", c.SignedInUser.GetOrgID()))
	}

	return isSqlEnabled, isAppliedForAdmin
}

func containsQueryType(hs *HTTPServer, enabledTypes []interface{}, queryType string, c *contextmodel.ReqContext) bool {
	// Log the input values
	hs.log.Debug(fmt.Sprintf("Checking if queryType '%s' exists in enabledTypes", queryType))

	for _, queryTypeItem := range enabledTypes {
		if queryTypeStr, ok := queryTypeItem.(string); ok {
			if queryTypeStr == queryType {
				return true
			}
		}
	}
	// Log the result if queryType is not found
	hs.log.Debug(fmt.Sprintf("TenantId: %d - QueryType '%s' not found in enabledTypes", c.SignedInUser.GetOrgID(), queryType))
	return false
}

func isSqlEnabledinRbac(c *contextmodel.ReqContext, hs *HTTPServer) bool {
	hs.log.Debug(fmt.Sprintf("TenantId: %d - Checking RBAC permissions for SQL access", c.SignedInUser.GetOrgID()))
	userPermissions := c.SignedInUser.GetPermissions()

	permissionList, exists := userPermissions["servicemanagement.querytypes:sql"]
	if !exists {
		hs.log.Debug(fmt.Sprintf("TenantId: %d - No RBAC permissions set for SQL, defaulting to false", c.SignedInUser.GetOrgID()))
		return false
	}

	// Check for valid permission
	for _, permission := range permissionList {
		if strings.HasSuffix(permission, ":*") {
			hs.log.Debug(fmt.Sprintf("TenantId: %d - User has SQL access via RBAC", c.SignedInUser.GetOrgID()))
			return true
		}
	}
	hs.log.Debug(fmt.Sprintf("TenantId: %d - No valid SQL permissions found in the list", c.SignedInUser.GetOrgID()))
	return false
}

//BMC CODE ENDS

// swagger:route GET /dashboards/home dashboards getHomeDashboard
//
// Get home dashboard.
//
// Responses:
// 200: getHomeDashboardResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetHomeDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetHomeDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var userID int64
	if id, err := identity.UserIdentifier(c.SignedInUser.GetID()); err == nil {
		userID = id
	}

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{OrgID: c.SignedInUser.GetOrgID(), UserID: userID, Teams: c.SignedInUser.GetTeams()}
	homePage := hs.Cfg.HomePage

	preference, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get preferences", err)
	}

	if preference.HomeDashboardID == 0 && len(homePage) > 0 {
		homePageRedirect := dtos.DashboardRedirect{RedirectUri: homePage}
		return response.JSON(http.StatusOK, &homePageRedirect)
	}

	if preference.HomeDashboardID != 0 {
		slugQuery := dashboards.GetDashboardRefByIDQuery{ID: preference.HomeDashboardID}
		slugQueryResult, err := hs.DashboardService.GetDashboardUIDByID(c.Req.Context(), &slugQuery)
		if err == nil {
			url := dashboards.GetDashboardURL(slugQueryResult.UID, slugQueryResult.Slug)
			dashRedirect := dtos.DashboardRedirect{RedirectUri: url}
			return response.JSON(http.StatusOK, &dashRedirect)
		}
		hs.log.Warn("Failed to get slug from database", "err", err)
	}

	filePath := hs.Cfg.DefaultHomeDashboardPath
	if filePath == "" {
		// BMC code - inline change
		filePath = filepath.Join(hs.Cfg.StaticRootPath, "dashboards/bmc_home.json")
	}

	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable
	// nolint:gosec
	file, err := os.Open(filePath)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to load home dashboard", err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			hs.log.Warn("Failed to close dashboard file", "path", filePath, "err", err)
		}
	}()

	dash := dtos.DashboardFullWithMeta{}
	dash.Meta.CanEdit = c.SignedInUser.HasRole(org.RoleEditor)
	dash.Meta.FolderTitle = "General"
	dash.Dashboard = simplejson.New()

	jsonParser := json.NewDecoder(file)
	if err := jsonParser.Decode(dash.Dashboard); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to load home dashboard", err)
	}

	// BMC code
	// Hide getting started panel on home page
	// hs.addGettingStartedPanelToHomeDashboard(c, dash.Dashboard)
	// End

	return response.JSON(http.StatusOK, &dash)
}

func (hs *HTTPServer) addGettingStartedPanelToHomeDashboard(c *contextmodel.ReqContext, dash *simplejson.Json) {
	ctx, span := tracer.Start(c.Req.Context(), "api.addGettingStartedPanelToHomeDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	// We only add this getting started panel for Admins who have not dismissed it,
	// and if a custom default home dashboard hasn't been configured
	if !c.HasUserRole(org.RoleAdmin) ||
		c.HasHelpFlag(user.HelpFlagGettingStartedPanelDismissed) ||
		hs.Cfg.DefaultHomeDashboardPath != "" {
		return
	}

	panels := dash.Get("panels").MustArray()

	newpanel := simplejson.NewFromAny(map[string]any{
		"type": "gettingstarted",
		"id":   123123,
		"gridPos": map[string]any{
			"x": 0,
			"y": 3,
			"w": 24,
			"h": 9,
		},
	})

	panels = append(panels, newpanel)
	dash.Set("panels", panels)
}

// swagger:route GET /dashboards/id/{DashboardID}/versions dashboard_versions getDashboardVersionsByID
//
// Gets all existing versions for the dashboard.
//
// Please refer to [updated API](#/dashboard_versions/getDashboardVersionsByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: dashboardVersionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/uid/{uid}/versions dashboard_versions getDashboardVersionsByUID
//
// Gets all existing versions for the dashboard using UID.
//
// Responses:
// 200: dashboardVersionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardVersions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardVersions")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var dashID int64

	var err error
	dashUID := web.Params(c.Req)[":uid"]

	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	query := dashver.ListDashboardVersionsQuery{
		OrgID:         c.SignedInUser.GetOrgID(),
		DashboardID:   dash.ID,
		DashboardUID:  dash.UID,
		Limit:         c.QueryInt("limit"),
		Start:         c.QueryInt("start"),
		ContinueToken: c.Query("continueToken"),
	}

	resp, err := hs.dashboardVersionService.List(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusNotFound, fmt.Sprintf("No versions found for dashboardId %d", dash.ID), err)
	}

	loginMem := make(map[int64]string, len(resp.Versions))
	res := make([]dashver.DashboardVersionMeta, 0, len(resp.Versions))
	for _, version := range resp.Versions {
		msg := version.Message
		if version.RestoredFrom == version.Version {
			msg = "Initial save (created by migration)"
		}

		if version.RestoredFrom > 0 {
			msg = fmt.Sprintf("Restored from version %d", version.RestoredFrom)
		}

		if version.ParentVersion == 0 {
			msg = "Initial save"
		}

		creator := anonString
		if version.CreatedBy > 0 {
			login, found := loginMem[version.CreatedBy]
			if found {
				creator = login
			} else {
				creator = hs.getIdentityName(c.Req.Context(), c.SignedInUser.GetOrgID(), version.CreatedBy)
				if creator != anonString {
					loginMem[version.CreatedBy] = creator
				}
			}
		}

		res = append(res, dashver.DashboardVersionMeta{
			ID:            version.ID,
			DashboardID:   version.DashboardID,
			DashboardUID:  dash.UID,
			Data:          version.Data,
			ParentVersion: version.ParentVersion,
			RestoredFrom:  version.RestoredFrom,
			Version:       version.Version,
			Created:       version.Created,
			Message:       msg,
			CreatedBy:     creator,
		})
	}

	return response.JSON(http.StatusOK, dashver.DashboardVersionResponseMeta{
		Versions:      res,
		ContinueToken: resp.ContinueToken,
	})
}

// swagger:route GET /dashboards/id/{DashboardID}/versions/{DashboardVersionID} dashboard_versions getDashboardVersionByID
//
// Get a specific dashboard version.
//
// Please refer to [updated API](#/dashboard_versions/getDashboardVersionByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: dashboardVersionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /dashboards/uid/{uid}/versions/{DashboardVersionID} dashboard_versions getDashboardVersionByUID
//
// Get a specific dashboard version using UID.
//
// Responses:
// 200: dashboardVersionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardVersion(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardVersion")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var dashID int64

	var err error
	dashUID := web.Params(c.Req)[":uid"]

	var dash *dashboards.Dashboard
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	version, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Err(err)
	}
	query := dashver.GetDashboardVersionQuery{
		OrgID:        c.SignedInUser.GetOrgID(),
		DashboardID:  dash.ID,
		DashboardUID: dash.UID,
		Version:      version,
	}

	res, err := hs.dashboardVersionService.Get(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, fmt.Sprintf("Dashboard version %d not found for dashboardId %d", query.Version, dash.ID), err)
	}

	creator := anonString
	if res.CreatedBy > 0 {
		creator = hs.getIdentityName(c.Req.Context(), dash.OrgID, res.CreatedBy)
	}

	dashVersionMeta := &dashver.DashboardVersionMeta{
		ID:            res.ID,
		DashboardID:   res.DashboardID,
		DashboardUID:  dash.UID,
		Data:          res.Data,
		ParentVersion: res.ParentVersion,
		RestoredFrom:  res.RestoredFrom,
		Version:       res.Version,
		Created:       res.Created,
		Message:       res.Message,
		CreatedBy:     creator,
	}

	return response.JSON(http.StatusOK, dashVersionMeta)
}

// swagger:route POST /dashboards/calculate-diff dashboards calculateDashboardDiff
//
// Perform diff on two dashboards.
//
// Produces:
// - application/json
// - text/html
//
// Responses:
// 200: calculateDashboardDiffResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) CalculateDashboardDiff(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.CalculateDashboardDiff")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	apiOptions := dtos.CalculateDiffOptions{}
	if err := web.Bind(c.Req, &apiOptions); err != nil {
		//BMC code change
		return response.Error(http.StatusBadRequest, "bad request data while calculating dashboard diff", err)
	}
	guardianBase, err := guardian.New(c.Req.Context(), apiOptions.Base.DashboardId, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canSave, err := guardianBase.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	if apiOptions.Base.DashboardId != apiOptions.New.DashboardId {
		guardianNew, err := guardian.New(c.Req.Context(), apiOptions.New.DashboardId, c.SignedInUser.GetOrgID(), c.SignedInUser)
		if err != nil {
			return response.Err(err)
		}

		if canSave, err := guardianNew.CanSave(); err != nil || !canSave {
			return dashboardGuardianResponse(err)
		}
	}

	options := dashdiffs.Options{
		OrgId:    c.SignedInUser.GetOrgID(),
		DiffType: dashdiffs.ParseDiffType(apiOptions.DiffType),
		Base: dashdiffs.DiffTarget{
			DashboardId:      apiOptions.Base.DashboardId,
			Version:          apiOptions.Base.Version,
			UnsavedDashboard: apiOptions.Base.UnsavedDashboard,
		},
		New: dashdiffs.DiffTarget{
			DashboardId:      apiOptions.New.DashboardId,
			Version:          apiOptions.New.Version,
			UnsavedDashboard: apiOptions.New.UnsavedDashboard,
		},
	}

	baseVersionQuery := dashver.GetDashboardVersionQuery{
		DashboardID: options.Base.DashboardId,
		Version:     options.Base.Version,
		OrgID:       options.OrgId,
	}

	baseVersionRes, err := hs.dashboardVersionService.Get(c.Req.Context(), &baseVersionQuery)
	if err != nil {
		if errors.Is(err, dashver.ErrDashboardVersionNotFound) {
			return response.Error(http.StatusNotFound, "Dashboard version not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to compute diff", err)
	}

	newVersionQuery := dashver.GetDashboardVersionQuery{
		DashboardID: options.New.DashboardId,
		Version:     options.New.Version,
		OrgID:       options.OrgId,
	}

	newVersionRes, err := hs.dashboardVersionService.Get(c.Req.Context(), &newVersionQuery)
	if err != nil {
		if errors.Is(err, dashver.ErrDashboardVersionNotFound) {
			return response.Error(http.StatusNotFound, "Dashboard version not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to compute diff", err)
	}

	baseData := baseVersionRes.Data
	newData := newVersionRes.Data

	result, err := dashdiffs.CalculateDiff(c.Req.Context(), &options, baseData, newData)
	if err != nil {
		if errors.Is(err, dashver.ErrDashboardVersionNotFound) {
			return response.Error(http.StatusNotFound, "Dashboard version not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to compute diff", err)
	}

	if options.DiffType == dashdiffs.DiffDelta {
		return response.Respond(http.StatusOK, result.Delta).SetHeader("Content-Type", "application/json")
	}

	return response.Respond(http.StatusOK, result.Delta).SetHeader("Content-Type", "text/html")
}

// swagger:route POST /dashboards/id/{DashboardID}/restore dashboard_versions restoreDashboardVersionByID
//
// Restore a dashboard to a given dashboard version.
//
// Please refer to [updated API](#/dashboard_versions/restoreDashboardVersionByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: postDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /dashboards/uid/{uid}/restore dashboard_versions restoreDashboardVersionByUID
//
// Restore a dashboard to a given dashboard version using UID.
//
// Responses:
// 200: postDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RestoreDashboardVersion(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.RestoreDashboardVersion")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var dashID int64

	var err error
	dashUID := web.Params(c.Req)[":uid"]

	apiCmd := dtos.RestoreDashboardVersionCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while restoring dashboard version", err)
	}
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), dashID, dashUID)
	if rsp != nil {
		return rsp
	}
	// BMC code
	dashID = dash.ID

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	versionQuery := dashver.GetDashboardVersionQuery{DashboardID: dashID, DashboardUID: dash.UID, Version: apiCmd.Version, OrgID: c.SignedInUser.GetOrgID()}
	version, err := hs.dashboardVersionService.Get(c.Req.Context(), &versionQuery)
	if err != nil {
		return response.Error(http.StatusNotFound, "Dashboard version not found", nil)
	}

	var userID int64
	if id, err := identity.UserIdentifier(c.SignedInUser.GetID()); err == nil {
		userID = id
	}

	saveCmd := dashboards.SaveDashboardCommand{}
	saveCmd.RestoredFrom = version.Version
	saveCmd.OrgID = c.SignedInUser.GetOrgID()
	saveCmd.UserID = userID
	saveCmd.Dashboard = version.Data
	saveCmd.Dashboard.Set("version", dash.Version)
	saveCmd.Dashboard.Set("uid", dash.UID)
	saveCmd.Message = dashverimpl.DashboardRestoreMessage(version.Version)
	// nolint:staticcheck
	saveCmd.FolderID = dash.FolderID
	metrics.MFolderIDsAPICount.WithLabelValues(metrics.RestoreDashboardVersion).Inc()
	saveCmd.FolderUID = dash.FolderUID

	return hs.postDashboard(c, saveCmd)
}

// swagger:route GET /dashboards/tags dashboards getDashboardTags
//
// Get all dashboards tags of an organisation.
//
// Responses:
// 200: getDashboardsTagsResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardTags(c *contextmodel.ReqContext) {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardTags")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	query := dashboards.GetDashboardTagsQuery{OrgID: c.SignedInUser.GetOrgID()}
	queryResult, err := hs.DashboardService.GetDashboardTags(c.Req.Context(), &query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get tags from database", err)
		return
	}

	c.JSON(http.StatusOK, queryResult)
}

// GetDashboardUIDs converts internal ids to UIDs
func (hs *HTTPServer) GetDashboardUIDs(c *contextmodel.ReqContext) {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardUIDs")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	ids := strings.Split(web.Params(c.Req)[":ids"], ",")
	uids := make([]string, 0, len(ids))

	q := &dashboards.GetDashboardRefByIDQuery{}
	for _, idstr := range ids {
		id, err := strconv.ParseInt(idstr, 10, 64)
		if err != nil {
			continue
		}
		q.ID = id
		qResult, err := hs.DashboardService.GetDashboardUIDByID(c.Req.Context(), q)
		if err != nil {
			continue
		}
		uids = append(uids, qResult.UID)
	}
	c.JSON(http.StatusOK, uids)
}

// swagger:parameters restoreDashboardVersionByID
type RestoreDashboardVersionByIDParams struct {
	// in:body
	// required:true
	Body dtos.RestoreDashboardVersionCommand
	// in:path
	DashboardID int64
}

// swagger:parameters getDashboardVersionsByID
type GetDashboardVersionsByIDParams struct {
	// in:path
	DashboardID int64
}

// swagger:parameters getDashboardVersionsByUID
type GetDashboardVersionsByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters restoreDashboardVersionByUID
type RestoreDashboardVersionByUIDParams struct {
	// in:body
	// required:true
	Body dtos.RestoreDashboardVersionCommand
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getDashboardVersionByID
type GetDashboardVersionByIDParams struct {
	// in:path
	DashboardID int64
	// in:path
	DashboardVersionID int64
}

// swagger:parameters getDashboardVersionByUID
type GetDashboardVersionByUIDParams struct {
	// in:path
	DashboardVersionID int64
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getDashboardVersions getDashboardVersionsByUID
type GetDashboardVersionsParams struct {
	// Maximum number of results to return
	// in:query
	// required:false
	// default:0
	Limit int `json:"limit"`

	// Version to start from when returning queries
	// in:query
	// required:false
	// default:0
	Start int `json:"start"`
}

// swagger:parameters getDashboardByUID
type GetDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters deleteDashboardByUID
type DeleteDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters hardDeleteDashboardByUID
type HardDeleteDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters postDashboard
type PostDashboardParams struct {
	// in:body
	// required:true
	Body dashboards.SaveDashboardCommand
}

// swagger:parameters calculateDashboardDiff
type CalcDashboardDiffParams struct {
	// in:body
	// required:true
	Body struct {
		Base dtos.CalculateDiffTarget `json:"base" binding:"Required"`
		New  dtos.CalculateDiffTarget `json:"new" binding:"Required"`
		// The type of diff to return
		// Description:
		// * `basic`
		// * `json`
		// Enum: basic,json
		DiffType string `json:"diffType" binding:"Required"`
	}
}

// swagger:response dashboardResponse
type DashboardResponse struct {
	// The response message
	// in: body
	Body dtos.DashboardFullWithMeta `json:"body"`
}

// swagger:response deleteDashboardResponse
type DeleteDashboardResponse struct {
	// The response message
	// in: body
	Body struct {
		// UID Identifier of the deleted dashboard.
		// required: true
		// example: 65
		UID string `json:"uid"`

		// Title Title of the deleted dashboard.
		// required: true
		// example: My Dashboard
		Title string `json:"title"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Dashboard My Dashboard deleted
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response postDashboardResponse
type PostDashboardResponse struct {
	// in: body
	Body struct {
		// Status status of the response.
		// required: true
		// example: success
		Status string `json:"status"`

		// Slug The slug of the dashboard.
		// required: true
		// example: my-dashboard
		Slug string `json:"title"`

		// Version The version of the dashboard.
		// required: true
		// example: 2
		Verion int64 `json:"version"`

		// ID The unique identifier (id) of the created/updated dashboard.
		// required: true
		// example: 1
		ID int64 `json:"id"`

		// UID The unique identifier (uid) of the created/updated dashboard.
		// required: true
		// example: nHz3SXiiz
		UID string `json:"uid"`

		// URL The relative URL for accessing the created/updated dashboard.
		// required: true
		// example: /d/nHz3SXiiz/my-dashboard
		URL string `json:"url"`

		// FolderUID The unique identifier (uid) of the folder the dashboard belongs to.
		// required: false
		FolderUID string `json:"folderUid"`
	} `json:"body"`
}

// swagger:response calculateDashboardDiffResponse
type CalculateDashboardDiffResponse struct {
	// in: body
	Body []byte `json:"body"`
}

// swagger:response getHomeDashboardResponse
type GetHomeDashboardResponse struct {
	// in: body
	Body GetHomeDashboardResponseBody `json:"body"`
}

// swagger:response getDashboardsTagsResponse
type DashboardsTagsResponse struct {
	// in: body
	Body []*dashboards.DashboardTagCloudItem `json:"body"`
}

// Get home dashboard response.
// swagger:model GetHomeDashboardResponse
type GetHomeDashboardResponseBody struct {
	// swagger:allOf
	// required: false
	dtos.DashboardFullWithMeta

	// swagger:allOf
	// required: false
	dtos.DashboardRedirect
}

// swagger:response dashboardVersionsResponse
type DashboardVersionsResponse struct {
	// in: body
	Body []dashver.DashboardVersionMeta `json:"body"`
}

// swagger:response dashboardVersionResponse
type DashboardVersionResponse struct {
	// in: body
	Body *dashver.DashboardVersionMeta `json:"body"`
}

// swagger:parameters restoreDeletedDashboardByUID
type RestoreDeletedDashboardByUID struct {
	// in:path
	// required:true
	UID string `json:"uid"`

	// in:body
	// required:true
	Body dashboards.RestoreDeletedDashboardCommand
}

// BMC changes start
func (hs *HTTPServer) getLocalesJson(dash *simplejson.Json) localization.LocalesJSON {
	localesJson := localization.LocalesJSON{Locales: make(map[localization.Locale]localization.ResourceLocales)}
	locales := dash.Get("locales")
	if locales == nil {
		hs.log.Info("No locales present in the dashboard")
		return localesJson
	}
	localeMap, err := locales.Map()
	if err != nil {
		hs.log.Error("Failed to parse locales", "error", err)
		return localesJson
	}
	for key, value := range localeMap {
		localeKey := localization.Locale(key)
		if !localization.IsSupportedLocale(localeKey) {
			continue
		}
		if data, ok := value.(map[string]interface{}); ok {
			// Extract the name and description fields
			if nameValue, ok := data["name"].(string); ok {
				localesJson.Locales[localeKey] = localization.ResourceLocales{
					Name: nameValue,
				}
			}
		}
	}
	return localesJson
}

// delete variable cache of these dashboards from Redis
func checkFFandDeleteCache(c *contextmodel.ReqContext, uid string) {
	if external.BHD_ENABLE_VAR_CACHING.Enabled(c.Req, c.SignedInUser) {
		pluginproxy.DeleteDashboardCache(c.OrgID, uid)
	}
}

// BMC Changes end

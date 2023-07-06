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

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/dashdiffs"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
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
	if !c.IsSignedIn {
		return false, nil
	}

	query := star.IsStarredByUserQuery{UserID: c.UserID, DashboardID: dashID}
	return hs.starService.IsStarredByUser(c.Req.Context(), &query)
}

func dashboardGuardianResponse(err error) response.Response {
	if err != nil {
		return response.Error(500, "Error while checking dashboard permissions", err)
	}
	return response.Error(403, "Access denied to this dashboard", nil)
}

// swagger:route POST /dashboards/trim dashboards trimDashboard
//
// Trim defaults from dashboard.
//
// Responses:
// 200: trimDashboardResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) TrimDashboard(c *contextmodel.ReqContext) response.Response {
	cmd := dashboards.TrimDashboardCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	dash := cmd.Dashboard
	meta := cmd.Meta

	// TODO temporarily just return the input as a no-op while we convert to thema calls
	dto := dtos.TrimDashboardFullWithMeta{
		Dashboard: dash,
		Meta:      meta,
	}

	c.TimeRequest(metrics.MApiDashboardGet)
	return response.JSON(http.StatusOK, dto)
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
// 500: internalServerError
func (hs *HTTPServer) GetDashboard(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, 0, uid)
	if rsp != nil {
		return rsp
	}

	var (
		publicDashboardEnabled = false
		err                    error
	)

	// If public dashboards is enabled and we have a public dashboard, update meta
	// values
	if hs.Features.IsEnabled(featuremgmt.FlagPublicDashboards) {
		publicDashboard, err := hs.PublicDashboardsApi.PublicDashboardService.FindByDashboardUid(c.Req.Context(), c.OrgID, dash.UID)
		if err != nil && !errors.Is(err, publicdashboardModels.ErrPublicDashboardNotFound) {
			return response.Error(500, "Error while retrieving public dashboards", err)
		}

		if publicDashboard != nil {
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
			return response.Error(500, "Error while loading dashboard, dashboard data is invalid", nil)
		}
	}
	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
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
		return response.Error(500, "Error while checking if dashboard was starred by user", err)
	}
	// Finding creator and last updater of the dashboard
	updater, creator := anonString, anonString
	if dash.UpdatedBy > 0 {
		updater = hs.getUserLogin(c.Req.Context(), dash.UpdatedBy)
	}
	if dash.CreatedBy > 0 {
		creator = hs.getUserLogin(c.Req.Context(), dash.CreatedBy)
	}

	annotationPermissions := &dtos.AnnotationPermission{}

	if !hs.AccessControl.IsDisabled() {
		hs.getAnnotationPermissionsByScope(c, &annotationPermissions.Dashboard, accesscontrol.ScopeAnnotationsTypeDashboard)
		hs.getAnnotationPermissionsByScope(c, &annotationPermissions.Organization, accesscontrol.ScopeAnnotationsTypeOrganization)
	}

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
		HasACL:                 dash.HasACL,
		IsFolder:               dash.IsFolder,
		FolderId:               dash.FolderID,
		Url:                    dash.GetURL(),
		FolderTitle:            "General",
		AnnotationsPermissions: annotationPermissions,
		PublicDashboardEnabled: publicDashboardEnabled,
	}

	// lookup folder title
	if dash.FolderID > 0 {
		query := dashboards.GetDashboardQuery{ID: dash.FolderID, OrgID: c.OrgID}
		queryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &query)
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return response.Error(404, "Folder not found", err)
			}
			return response.Error(500, "Dashboard folder could not be read", err)
		}
		meta.FolderUid = queryResult.UID
		meta.FolderTitle = queryResult.Title
		meta.FolderUrl = queryResult.GetURL()
	}

	provisioningData, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardID(c.Req.Context(), dash.ID)
	if err != nil {
		return response.Error(500, "Error while checking if dashboard is provisioned", err)
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
	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) getAnnotationPermissionsByScope(c *contextmodel.ReqContext, actions *dtos.AnnotationActions, scope string) {
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

func (hs *HTTPServer) getUserLogin(ctx context.Context, userID int64) string {
	query := user.GetUserByIDQuery{ID: userID}
	user, err := hs.userService.GetByID(ctx, &query)
	if err != nil {
		return anonString
	}
	return user.Login
}

func (hs *HTTPServer) getDashboardHelper(ctx context.Context, orgID int64, id int64, uid string) (*dashboards.Dashboard, response.Response) {
	var query dashboards.GetDashboardQuery

	if len(uid) > 0 {
		query = dashboards.GetDashboardQuery{UID: uid, ID: id, OrgID: orgID}
	} else {
		query = dashboards.GetDashboardQuery{ID: id, OrgID: orgID}
	}

	queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
	if err != nil {
		return nil, response.Error(404, "Dashboard not found", err)
	}

	return queryResult, nil
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

func (hs *HTTPServer) deleteDashboard(c *contextmodel.ReqContext) response.Response {
	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, 0, web.Params(c.Req)[":uid"])
	if rsp != nil {
		return rsp
	}
	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canDelete, err := guardian.CanDelete(); err != nil || !canDelete {
		return dashboardGuardianResponse(err)
	}

	// disconnect all library elements for this dashboard
	err = hs.LibraryElementService.DisconnectElementsFromDashboard(c.Req.Context(), dash.ID)
	if err != nil {
		hs.log.Error("Failed to disconnect library elements", "dashboard", dash.ID, "user", c.SignedInUser.UserID, "error", err)
	}

	// deletes all related public dashboard entities
	err = hs.PublicDashboardsApi.PublicDashboardService.DeleteByDashboard(c.Req.Context(), dash)
	if err != nil {
		hs.log.Error("Failed to delete public dashboard")
	}

	err = hs.DashboardService.DeleteDashboard(c.Req.Context(), dash.ID, c.OrgID)
	if err != nil {
		var dashboardErr dashboards.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if errors.Is(err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard) {
				return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
			}
		}
		return response.Error(500, "Failed to delete dashboard", err)
	}

	if hs.Live != nil {
		err := hs.Live.GrafanaScope.Dashboards.DashboardDeleted(c.OrgID, c.ToUserDisplayDTO(), dash.UID)
		if err != nil {
			hs.log.Error("Failed to broadcast delete info", "dashboard", dash.UID, "error", err)
		}
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"title":   dash.Title,
		"message": fmt.Sprintf("Dashboard %s deleted", dash.Title),
		"id":      dash.ID,
	})
}

// swagger:route POST /dashboards/db dashboards postDashboard
//
// Create / Update dashboard
//
// Creates a new dashboard or updates an existing dashboard.
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
	cmd := dashboards.SaveDashboardCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if hs.Features.IsEnabled(featuremgmt.FlagValidateDashboardsOnSave) {
		kind := hs.Kinds.Dashboard()

		dashbytes, err := cmd.Dashboard.Bytes()
		if err != nil {
			return response.Error(http.StatusBadRequest, "unable to parse dashboard", err)
		}
		// Ideally, coremodel validation calls would be integrated into the web
		// framework. But this does the job for now.
		schv, err := cmd.Dashboard.Get("schemaVersion").Int()

		// Only try to validate if the schemaVersion is at least the handoff version
		// (the minimum schemaVersion against which the dashboard schema is known to
		// work), or if schemaVersion is absent (which will happen once the kind schema
		// becomes canonical).
		if err != nil || schv >= dashboard.HandoffSchemaVersion {
			if _, _, err := kind.JSONValueMux(dashbytes); err != nil {
				return response.Error(http.StatusBadRequest, "invalid dashboard json", err)
			}
		}
	}

	return hs.postDashboard(c, cmd)
}

func (hs *HTTPServer) postDashboard(c *contextmodel.ReqContext, cmd dashboards.SaveDashboardCommand) response.Response {
	ctx := c.Req.Context()
	var err error
	cmd.OrgID = c.OrgID
	cmd.UserID = c.UserID
	if cmd.FolderUID != "" {
		folder, err := hs.folderService.Get(ctx, &folder.GetFolderQuery{
			OrgID:        c.OrgID,
			UID:          &cmd.FolderUID,
			SignedInUser: c.SignedInUser,
		})
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return response.Error(400, "Folder not found", err)
			}
			return response.Error(500, "Error while checking folder ID", err)
		}
		cmd.FolderID = folder.ID
	}

	dash := cmd.GetDashboardModel()
	newDashboard := dash.ID == 0
	if newDashboard {
		limitReached, err := hs.QuotaService.QuotaReached(c, dashboards.QuotaTargetSrv)
		if err != nil {
			return response.Error(500, "failed to get quota", err)
		}
		if limitReached {
			return response.Error(403, "Quota reached", nil)
		}
	}

	var provisioningData *dashboards.DashboardProvisioning
	if dash.ID != 0 {
		data, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardID(c.Req.Context(), dash.ID)
		if err != nil {
			return response.Error(500, "Error while checking if dashboard is provisioned using ID", err)
		}
		provisioningData = data
	} else if dash.UID != "" {
		data, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardUID(c.Req.Context(), dash.OrgID, dash.UID)
		if err != nil && !errors.Is(err, dashboards.ErrProvisionedDashboardNotFound) && !errors.Is(err, dashboards.ErrDashboardNotFound) {
			return response.Error(500, "Error while checking if dashboard is provisioned", err)
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
		OrgID:     c.OrgID,
		User:      c.SignedInUser,
		Overwrite: cmd.Overwrite,
	}

	dashboard, err := hs.DashboardService.SaveDashboard(alerting.WithUAEnabled(ctx, hs.Cfg.UnifiedAlerting.IsEnabled()), dashItem, allowUiUpdate)

	if hs.Live != nil {
		// Tell everyone listening that the dashboard changed
		if dashboard == nil {
			dashboard = dash // the original request
		}

		// This will broadcast all save requests only if a `gitops` observer exists.
		// gitops is useful when trying to save dashboards in an environment where the user can not save
		channel := hs.Live.GrafanaScope.Dashboards
		liveerr := channel.DashboardSaved(c.SignedInUser.OrgID, c.SignedInUser.ToUserDisplayDTO(), cmd.Message, dashboard, err)

		// When an error exists, but the value broadcast to a gitops listener return 202
		if liveerr == nil && err != nil && channel.HasGitOpsObserver(c.SignedInUser.OrgID) {
			return response.JSON(202, util.DynMap{
				"status":  "pending",
				"message": "changes were broadcast to the gitops listener",
			})
		}

		if liveerr != nil {
			hs.log.Warn("unable to broadcast save event", "uid", dashboard.UID, "error", liveerr)
		}
	}

	if err != nil {
		return apierrors.ToDashboardErrorResponse(ctx, hs.pluginStore, err)
	}

	// Clear permission cache for the user who's created the dashboard, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	if newDashboard && !hs.accesscontrolService.IsDisabled() {
		hs.accesscontrolService.ClearUserPermissionCache(c.SignedInUser)
	}

	// connect library panels for this dashboard after the dashboard is stored and has an ID
	err = hs.LibraryPanelService.ConnectLibraryPanelsForDashboard(ctx, c.SignedInUser, dashboard)
	if err != nil {
		return response.Error(500, "Error while connecting library panels", err)
	}

	c.TimeRequest(metrics.MApiDashboardSave)
	return response.JSON(http.StatusOK, util.DynMap{
		"status":  "success",
		"slug":    dashboard.Slug,
		"version": dashboard.Version,
		"id":      dashboard.ID,
		"uid":     dashboard.UID,
		"url":     dashboard.GetURL(),
	})
}

// swagger:route GET /dashboards/home dashboards getHomeDashboard
//
// Get home dashboard.
//
// Responses:
// 200: getHomeDashboardResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetHomeDashboard(c *contextmodel.ReqContext) response.Response {
	prefsQuery := pref.GetPreferenceWithDefaultsQuery{OrgID: c.OrgID, UserID: c.SignedInUser.UserID, Teams: c.Teams}
	homePage := hs.Cfg.HomePage

	preference, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return response.Error(500, "Failed to get preferences", err)
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
		filePath = filepath.Join(hs.Cfg.StaticRootPath, "dashboards/home.json")
	}

	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable
	// nolint:gosec
	file, err := os.Open(filePath)
	if err != nil {
		return response.Error(500, "Failed to load home dashboard", err)
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
		return response.Error(500, "Failed to load home dashboard", err)
	}

	hs.addGettingStartedPanelToHomeDashboard(c, dash.Dashboard)

	return response.JSON(http.StatusOK, &dash)
}

func (hs *HTTPServer) addGettingStartedPanelToHomeDashboard(c *contextmodel.ReqContext, dash *simplejson.Json) {
	// We only add this getting started panel for Admins who have not dismissed it,
	// and if a custom default home dashboard hasn't been configured
	if !c.HasUserRole(org.RoleAdmin) ||
		c.HasHelpFlag(user.HelpFlagGettingStartedPanelDismissed) ||
		hs.Cfg.DefaultHomeDashboardPath != "" {
		return
	}

	panels := dash.Get("panels").MustArray()

	newpanel := simplejson.NewFromAny(map[string]interface{}{
		"type": "gettingstarted",
		"id":   123123,
		"gridPos": map[string]interface{}{
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
	var dashID int64

	var err error
	dashUID := web.Params(c.Req)[":uid"]

	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	query := dashver.ListDashboardVersionsQuery{
		OrgID:        c.OrgID,
		DashboardID:  dash.ID,
		DashboardUID: dash.UID,
		Limit:        c.QueryInt("limit"),
		Start:        c.QueryInt("start"),
	}

	versions, err := hs.dashboardVersionService.List(c.Req.Context(), &query)
	if err != nil {
		return response.Error(404, fmt.Sprintf("No versions found for dashboardId %d", dash.ID), err)
	}

	loginMem := make(map[int64]string, len(versions))
	res := make([]dashver.DashboardVersionMeta, 0, len(versions))
	for _, version := range versions {
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
				creator = hs.getUserLogin(c.Req.Context(), version.CreatedBy)
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

	return response.JSON(http.StatusOK, res)
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

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	version, _ := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 32)
	query := dashver.GetDashboardVersionQuery{
		OrgID:        c.OrgID,
		DashboardID:  dash.ID,
		DashboardUID: dash.UID,
		Version:      int(version),
	}

	res, err := hs.dashboardVersionService.Get(c.Req.Context(), &query)
	if err != nil {
		return response.Error(500, fmt.Sprintf("Dashboard version %d not found for dashboardId %d", query.Version, dash.ID), err)
	}

	creator := anonString
	if res.CreatedBy > 0 {
		creator = hs.getUserLogin(c.Req.Context(), res.CreatedBy)
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

// swagger:route POST /dashboards/validate dashboards alpha validateDashboard
//
// Validates a dashboard JSON against the schema.
//
// Produces:
// - application/json
//
// Responses:
// 200: validateDashboardResponse
// 412: validateDashboardResponse
// 422: validateDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) ValidateDashboard(c *contextmodel.ReqContext) response.Response {
	cmd := dashboards.ValidateDashboardCommand{}

	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	dk := hs.Kinds.Dashboard()
	dashboardBytes := []byte(cmd.Dashboard)

	// POST api receives dashboard as a string of json (so line numbers for errors stay consistent),
	// but we need to parse the schema version out of it
	dashboardJson, err := simplejson.NewJson(dashboardBytes)
	if err != nil {
		return response.Error(http.StatusBadRequest, "unable to parse dashboard", err)
	}

	schemaVersion, err := dashboardJson.Get("schemaVersion").Int()

	isValid := false
	statusCode := http.StatusOK
	validationMessage := ""

	// Only try to validate if the schemaVersion is at least the handoff version
	// (the minimum schemaVersion against which the dashboard schema is known to
	// work), or if schemaVersion is absent (which will happen once the Thema
	// schema becomes canonical).
	if err != nil || schemaVersion >= dashboard.HandoffSchemaVersion {
		// Schemas expect the dashboard to live in the spec field
		k8sResource := `{"spec": ` + cmd.Dashboard + "}"

		_, _, validationErr := dk.JSONValueMux([]byte(k8sResource))

		if validationErr == nil {
			isValid = true
		} else {
			validationMessage = validationErr.Error()
			statusCode = http.StatusUnprocessableEntity
		}
	} else {
		validationMessage = "invalid schema version"
		statusCode = http.StatusPreconditionFailed
	}

	respData := &ValidateDashboardResponse{
		IsValid: isValid,
		Message: validationMessage,
	}

	return response.JSON(statusCode, respData)
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
	apiOptions := dtos.CalculateDiffOptions{}
	if err := web.Bind(c.Req, &apiOptions); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	guardianBase, err := guardian.New(c.Req.Context(), apiOptions.Base.DashboardId, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canSave, err := guardianBase.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	if apiOptions.Base.DashboardId != apiOptions.New.DashboardId {
		guardianNew, err := guardian.New(c.Req.Context(), apiOptions.New.DashboardId, c.OrgID, c.SignedInUser)
		if err != nil {
			return response.Err(err)
		}

		if canSave, err := guardianNew.CanSave(); err != nil || !canSave {
			return dashboardGuardianResponse(err)
		}
	}

	options := dashdiffs.Options{
		OrgId:    c.OrgID,
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
			return response.Error(404, "Dashboard version not found", err)
		}
		return response.Error(500, "Unable to compute diff", err)
	}

	newVersionQuery := dashver.GetDashboardVersionQuery{
		DashboardID: options.New.DashboardId,
		Version:     options.New.Version,
		OrgID:       options.OrgId,
	}

	newVersionRes, err := hs.dashboardVersionService.Get(c.Req.Context(), &newVersionQuery)
	if err != nil {
		if errors.Is(err, dashver.ErrDashboardVersionNotFound) {
			return response.Error(404, "Dashboard version not found", err)
		}
		return response.Error(500, "Unable to compute diff", err)
	}

	baseData := baseVersionRes.Data
	newData := newVersionRes.Data

	result, err := dashdiffs.CalculateDiff(c.Req.Context(), &options, baseData, newData)

	if err != nil {
		if errors.Is(err, dashver.ErrDashboardVersionNotFound) {
			return response.Error(404, "Dashboard version not found", err)
		}
		return response.Error(500, "Unable to compute diff", err)
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
	var dashID int64

	var err error
	dashUID := web.Params(c.Req)[":uid"]

	apiCmd := dtos.RestoreDashboardVersionCommand{}
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.OrgID, dashID, dashUID)
	if rsp != nil {
		return rsp
	}

	guardian, err := guardian.NewByDashboard(c.Req.Context(), dash, c.OrgID, c.SignedInUser)
	if err != nil {
		return response.Err(err)
	}

	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	versionQuery := dashver.GetDashboardVersionQuery{DashboardID: dashID, DashboardUID: dash.UID, Version: apiCmd.Version, OrgID: c.OrgID}
	version, err := hs.dashboardVersionService.Get(c.Req.Context(), &versionQuery)
	if err != nil {
		return response.Error(404, "Dashboard version not found", nil)
	}

	saveCmd := dashboards.SaveDashboardCommand{}
	saveCmd.RestoredFrom = version.Version
	saveCmd.OrgID = c.OrgID
	saveCmd.UserID = c.UserID
	saveCmd.Dashboard = version.Data
	saveCmd.Dashboard.Set("version", dash.Version)
	saveCmd.Dashboard.Set("uid", dash.UID)
	saveCmd.Message = fmt.Sprintf("Restored from version %d", version.Version)
	saveCmd.FolderID = dash.FolderID

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
	query := dashboards.GetDashboardTagsQuery{OrgID: c.OrgID}
	queryResult, err := hs.DashboardService.GetDashboardTags(c.Req.Context(), &query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get tags from database", err)
		return
	}

	c.JSON(http.StatusOK, queryResult)
}

// GetDashboardUIDs converts internal ids to UIDs
func (hs *HTTPServer) GetDashboardUIDs(c *contextmodel.ReqContext) {
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

// swagger:parameters renderReportPDF
type RenderReportPDFParams struct {
	// in:path
	DashboardID int64
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

// swagger:parameters trimDashboard
type TrimDashboardParams struct {
	// in:body
	// required:true
	Body dashboards.TrimDashboardCommand
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
		// ID Identifier of the deleted dashboard.
		// required: true
		// example: 65
		ID int64 `json:"id"`

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
		ID string `json:"id"`

		// UID The unique identifier (uid) of the created/updated dashboard.
		// required: true
		// example: nHz3SXiiz
		UID string `json:"uid"`

		// URL The relative URL for accessing the created/updated dashboard.
		// required: true
		// example: /d/nHz3SXiiz/my-dashboard
		URL string `json:"url"`
	} `json:"body"`
}

// swagger:response calculateDashboardDiffResponse
type CalculateDashboardDiffResponse struct {
	// in: body
	Body []byte `json:"body"`
}

// swagger:response trimDashboardResponse
type TrimDashboardResponse struct {
	// in: body
	Body dtos.TrimDashboardFullWithMeta `json:"body"`
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

// swagger:response validateDashboardResponse
type ValidateDashboardResponse struct {
	IsValid bool   `json:"isValid"`
	Message string `json:"message,omitempty"`
}

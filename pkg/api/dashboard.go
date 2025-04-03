package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"
	dashboardsV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/dashdiffs"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/dashboardversion/dashverimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
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
		var dashboardErr dashboardaccess.DashboardErr
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

	dashScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID)
	writeEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashScope)
	canSave, _ := hs.AccessControl.Evaluate(ctx, c.SignedInUser, writeEvaluator)
	canEdit := canSave
	//nolint:staticcheck // ViewersCanEdit is deprecated but still used for backward compatibility
	if hs.Cfg.ViewersCanEdit {
		canEdit = true
	}
	deleteEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashScope)
	canDelete, _ := hs.AccessControl.Evaluate(ctx, c.SignedInUser, deleteEvaluator)
	adminEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashScope)
	canAdmin, _ := hs.AccessControl.Evaluate(ctx, c.SignedInUser, adminEvaluator)

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

	annotationPermissions := &dashboardsV1.AnnotationPermission{}
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
	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) getAnnotationPermissionsByScope(c *contextmodel.ReqContext, actions *dashboardsV1.AnnotationActions, scope string) {
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
	ctx, span := tracer.Start(c.Req.Context(), "api.deleteDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]

	var rsp response.Response
	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), 0, uid)
	if rsp != nil {
		return rsp
	}
	if dash.IsFolder {
		return response.Error(http.StatusBadRequest, "Use folders endpoint for deleting folders.", nil)
	}

	// disconnect all library elements for this dashboard
	err := hs.LibraryElementService.DisconnectElementsFromDashboard(c.Req.Context(), dash.ID)
	if err != nil {
		hs.log.Error(
			"Failed to disconnect library elements",
			"dashboard", dash.ID,
			"identity", c.GetID(),
			"error", err)
	}

	err = hs.DashboardService.DeleteDashboard(c.Req.Context(), dash.ID, dash.UID, c.SignedInUser.GetOrgID())
	if err != nil {
		var dashboardErr dashboardaccess.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if errors.Is(err, dashboards.ErrDashboardCannotDeleteProvisionedDashboard) {
				return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
			}
		}

		var statusErr *k8serrors.StatusError
		if errors.As(err, &statusErr) {
			return response.Error(int(statusErr.ErrStatus.Code), statusErr.ErrStatus.Message, err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to delete dashboard", err)
	}

	if hs.Live != nil {
		err := hs.Live.GrafanaScope.Dashboards.DashboardDeleted(c.SignedInUser.GetOrgID(), c.SignedInUser, dash.UID)
		if err != nil {
			hs.log.Error("Failed to broadcast delete info", "dashboard", dash.UID, "error", err)
		}
	}

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
		return response.Error(http.StatusBadRequest, "bad request data", err)
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
			return response.Error(http.StatusInternalServerError, "Error while checking if dashboard is provisioned using ID", err)
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
			return response.JSON(http.StatusAccepted, util.DynMap{
				"status":  "pending",
				"message": "changes were broadcast to the gitops listener",
			})
		}

		if liveerr != nil {
			hs.log.Warn("Unable to broadcast save event", "uid", dashboard.UID, "error", liveerr)
		}
	}

	if saveErr != nil {
		return apierrors.ToDashboardErrorResponse(ctx, hs.pluginStore, saveErr)
	}

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
		filePath = filepath.Join(hs.Cfg.StaticRootPath, "dashboards/home.json")
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

	hs.addGettingStartedPanelToHomeDashboard(c, dash.Dashboard)

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
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScope(strconv.FormatInt(apiOptions.Base.DashboardId, 10)))
	if canWrite, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator); err != nil || !canWrite {
		return dashboardGuardianResponse(err)
	}

	if apiOptions.Base.DashboardId != apiOptions.New.DashboardId {
		evaluator = accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScope(strconv.FormatInt(apiOptions.New.DashboardId, 10)))
		if canWrite, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator); err != nil || !canWrite {
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
		return response.Error(http.StatusBadRequest, "bad request data", err)
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

	versionQuery := dashver.GetDashboardVersionQuery{DashboardID: dashID, DashboardUID: dash.UID, Version: apiCmd.Version, OrgID: c.SignedInUser.GetOrgID()}
	version, err := hs.dashboardVersionService.Get(c.Req.Context(), &versionQuery)
	if err != nil {
		return response.Error(http.StatusNotFound, "Dashboard version not found", nil)
	}

	// do not allow restores if the json data is identical
	// this is needed for the k8s flow, as the generation id will be used on the
	// version table, and the generation id only increments when the actual spec is changed
	if compareDashboardData(version.Data.MustMap(), dash.Data.MustMap()) {
		return response.Error(http.StatusBadRequest, "Current dashboard is identical to the specified version", nil)
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

func compareDashboardData(versionData, dashData map[string]any) bool {
	// these can be different but the actual data is the same
	delete(versionData, "version")
	delete(dashData, "version")
	delete(versionData, "id")
	delete(dashData, "id")
	delete(versionData, "uid")
	delete(dashData, "uid")

	return reflect.DeepEqual(versionData, dashData)
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

package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/dashdiffs"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

const (
	anonString = "Anonymous"
)

func isDashboardStarredByUser(c *models.ReqContext, dashID int64) (bool, error) {
	if !c.IsSignedIn {
		return false, nil
	}

	query := models.IsStarredByUserQuery{UserId: c.UserId, DashboardId: dashID}
	if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
		return false, err
	}

	return query.Result, nil
}

func dashboardGuardianResponse(err error) response.Response {
	if err != nil {
		return response.Error(500, "Error while checking dashboard permissions", err)
	}

	return response.Error(403, "Access denied to this dashboard", nil)
}

func (hs *HTTPServer) TrimDashboard(c *models.ReqContext, cmd models.TrimDashboardCommand) response.Response {
	var err error
	dash := cmd.Dashboard
	meta := cmd.Meta

	trimedResult := *dash
	if !hs.LoadSchemaService.IsDisabled() {
		trimedResult, err = hs.LoadSchemaService.DashboardTrimDefaults(*dash)
		if err != nil {
			return response.Error(500, "Error while exporting with default values removed", err)
		}
	}

	dto := dtos.TrimDashboardFullWithMeta{
		Dashboard: &trimedResult,
		Meta:      meta,
	}

	c.TimeRequest(metrics.MApiDashboardGet)
	return response.JSON(200, dto)
}

func (hs *HTTPServer) GetDashboard(c *models.ReqContext) response.Response {
	uid := c.Params(":uid")
	dash, rsp := getDashboardHelper(c.Req.Context(), c.OrgId, 0, uid)
	if rsp != nil {
		return rsp
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

	guardian := guardian.New(dash.Id, c.OrgId, c.SignedInUser)
	if canView, err := guardian.CanView(); err != nil || !canView {
		return dashboardGuardianResponse(err)
	}

	canEdit, _ := guardian.CanEdit()
	canSave, _ := guardian.CanSave()
	canAdmin, _ := guardian.CanAdmin()

	isStarred, err := isDashboardStarredByUser(c, dash.Id)
	if err != nil {
		return response.Error(500, "Error while checking if dashboard was starred by user", err)
	}

	// Finding creator and last updater of the dashboard
	updater, creator := anonString, anonString
	if dash.UpdatedBy > 0 {
		updater = getUserLogin(c.Req.Context(), dash.UpdatedBy)
	}
	if dash.CreatedBy > 0 {
		creator = getUserLogin(c.Req.Context(), dash.CreatedBy)
	}

	meta := dtos.DashboardMeta{
		IsStarred:   isStarred,
		Slug:        dash.Slug,
		Type:        models.DashTypeDB,
		CanStar:     c.IsSignedIn,
		CanSave:     canSave,
		CanEdit:     canEdit,
		CanAdmin:    canAdmin,
		Created:     dash.Created,
		Updated:     dash.Updated,
		UpdatedBy:   updater,
		CreatedBy:   creator,
		Version:     dash.Version,
		HasAcl:      dash.HasAcl,
		IsFolder:    dash.IsFolder,
		FolderId:    dash.FolderId,
		Url:         dash.GetUrl(),
		FolderTitle: "General",
	}

	// lookup folder title
	if dash.FolderId > 0 {
		query := models.GetDashboardQuery{Id: dash.FolderId, OrgId: c.OrgId}
		if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
			if errors.Is(err, models.ErrFolderNotFound) {
				return response.Error(404, "Folder not found", err)
			}
			return response.Error(500, "Dashboard folder could not be read", err)
		}
		meta.FolderUid = query.Result.Uid
		meta.FolderTitle = query.Result.Title
		meta.FolderUrl = query.Result.GetUrl()
	}

	svc := dashboards.NewProvisioningService(hs.SQLStore)
	provisioningData, err := svc.GetProvisionedDashboardDataByDashboardID(dash.Id)
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
			provisioningData.ExternalId,
		)
		if err != nil {
			// Not sure when this could happen so not sure how to better handle this. Right now ProvisionedExternalId
			// is for better UX, showing in Save/Delete dialogs and so it won't break anything if it is empty.
			hs.log.Warn("Failed to create ProvisionedExternalId", "err", err)
		}
	}

	// make sure db version is in sync with json model version
	dash.Data.Set("version", dash.Version)

	// load library panels JSON for this dashboard
	err = hs.LibraryPanelService.LoadLibraryPanelsForDashboard(c, dash)
	if err != nil {
		return response.Error(500, "Error while loading library panels", err)
	}

	dto := dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta:      meta,
	}

	c.TimeRequest(metrics.MApiDashboardGet)
	return response.JSON(200, dto)
}

func getUserLogin(ctx context.Context, userID int64) string {
	query := models.GetUserByIdQuery{Id: userID}
	err := bus.DispatchCtx(ctx, &query)
	if err != nil {
		return anonString
	}
	return query.Result.Login
}

func getDashboardHelper(ctx context.Context, orgID int64, id int64, uid string) (*models.Dashboard, response.Response) {
	var query models.GetDashboardQuery

	if len(uid) > 0 {
		query = models.GetDashboardQuery{Uid: uid, Id: id, OrgId: orgID}
	} else {
		query = models.GetDashboardQuery{Id: id, OrgId: orgID}
	}

	if err := bus.DispatchCtx(ctx, &query); err != nil {
		return nil, response.Error(404, "Dashboard not found", err)
	}

	return query.Result, nil
}

func (hs *HTTPServer) DeleteDashboardBySlug(c *models.ReqContext) response.Response {
	query := models.GetDashboardsBySlugQuery{OrgId: c.OrgId, Slug: c.Params(":slug")}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to retrieve dashboards by slug", err)
	}

	if len(query.Result) > 1 {
		return response.JSON(412, util.DynMap{"status": "multiple-slugs-exists", "message": models.ErrDashboardsWithSameSlugExists.Error()})
	}

	return hs.deleteDashboard(c)
}

func (hs *HTTPServer) DeleteDashboardByUID(c *models.ReqContext) response.Response {
	return hs.deleteDashboard(c)
}

func (hs *HTTPServer) deleteDashboard(c *models.ReqContext) response.Response {
	dash, rsp := getDashboardHelper(c.Req.Context(), c.OrgId, 0, c.Params(":uid"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.New(dash.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	// disconnect all library elements for this dashboard
	err := hs.LibraryElementService.DisconnectElementsFromDashboard(c, dash.Id)
	if err != nil {
		hs.log.Error("Failed to disconnect library elements", "dashboard", dash.Id, "user", c.SignedInUser.UserId, "error", err)
	}

	svc := dashboards.NewService(hs.SQLStore)
	err = svc.DeleteDashboard(dash.Id, c.OrgId)
	if err != nil {
		var dashboardErr models.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			if errors.Is(err, models.ErrDashboardCannotDeleteProvisionedDashboard) {
				return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
			}
		}

		return response.Error(500, "Failed to delete dashboard", err)
	}

	if hs.Live != nil {
		err := hs.Live.GrafanaScope.Dashboards.DashboardDeleted(c.OrgId, c.ToUserDisplayDTO(), dash.Uid)
		if err != nil {
			hs.log.Error("Failed to broadcast delete info", "dashboard", dash.Uid, "error", err)
		}
	}

	return response.JSON(200, util.DynMap{
		"title":   dash.Title,
		"message": fmt.Sprintf("Dashboard %s deleted", dash.Title),
		"id":      dash.Id,
	})
}

func (hs *HTTPServer) PostDashboard(c *models.ReqContext, cmd models.SaveDashboardCommand) response.Response {
	var err error
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId
	if cmd.FolderUid != "" {
		folders := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
		folder, err := folders.GetFolderByUID(cmd.FolderUid)
		if err != nil {
			if errors.Is(err, models.ErrFolderNotFound) {
				return response.Error(400, "Folder not found", err)
			}
			return response.Error(500, "Error while checking folder ID", err)
		}
		cmd.FolderId = folder.Id
	}

	dash := cmd.GetDashboardModel()
	newDashboard := dash.Id == 0
	if newDashboard {
		limitReached, err := hs.QuotaService.QuotaReached(c, "dashboard")
		if err != nil {
			return response.Error(500, "failed to get quota", err)
		}
		if limitReached {
			return response.Error(403, "Quota reached", nil)
		}
	}

	svc := dashboards.NewProvisioningService(hs.SQLStore)
	provisioningData, err := svc.GetProvisionedDashboardDataByDashboardID(dash.Id)
	if err != nil {
		return response.Error(500, "Error while checking if dashboard is provisioned", err)
	}

	allowUiUpdate := true
	if provisioningData != nil {
		allowUiUpdate = hs.ProvisioningService.GetAllowUIUpdatesFromConfig(provisioningData.Name)
	}

	// clean up all unnecessary library panels JSON properties so we store a minimum JSON
	err = hs.LibraryPanelService.CleanLibraryPanelsForDashboard(dash)
	if err != nil {
		return response.Error(500, "Error while cleaning library panels", err)
	}

	dashItem := &dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   cmd.Message,
		OrgId:     c.OrgId,
		User:      c.SignedInUser,
		Overwrite: cmd.Overwrite,
	}

	dashSvc := dashboards.NewService(hs.SQLStore)
	dashboard, err := dashSvc.SaveDashboard(dashItem, allowUiUpdate)

	if hs.Live != nil {
		// Tell everyone listening that the dashboard changed
		if dashboard == nil {
			dashboard = dash // the original request
		}

		// This will broadcast all save requets only if a `gitops` observer exists.
		// gitops is useful when trying to save dashboards in an environment where the user can not save
		channel := hs.Live.GrafanaScope.Dashboards
		liveerr := channel.DashboardSaved(c.SignedInUser.OrgId, c.SignedInUser.ToUserDisplayDTO(), cmd.Message, dashboard, err)

		// When an error exists, but the value broadcast to a gitops listener return 202
		if liveerr == nil && err != nil && channel.HasGitOpsObserver(c.SignedInUser.OrgId) {
			return response.JSON(202, util.DynMap{
				"status":  "pending",
				"message": "changes were broadcast to the gitops listener",
			})
		}

		if liveerr != nil {
			hs.log.Warn("unable to broadcast save event", "uid", dashboard.Uid, "error", err)
		}
	}

	if err != nil {
		return hs.dashboardSaveErrorToApiResponse(err)
	}

	if hs.Cfg.EditorsCanAdmin && newDashboard {
		inFolder := cmd.FolderId > 0
		err := dashSvc.MakeUserAdmin(cmd.OrgId, cmd.UserId, dashboard.Id, !inFolder)
		if err != nil {
			hs.log.Error("Could not make user admin", "dashboard", dashboard.Title, "user", c.SignedInUser.UserId, "error", err)
		}
	}

	// connect library panels for this dashboard after the dashboard is stored and has an ID
	err = hs.LibraryPanelService.ConnectLibraryPanelsForDashboard(c, dashboard)
	if err != nil {
		return response.Error(500, "Error while connecting library panels", err)
	}

	c.TimeRequest(metrics.MApiDashboardSave)
	return response.JSON(200, util.DynMap{
		"status":  "success",
		"slug":    dashboard.Slug,
		"version": dashboard.Version,
		"id":      dashboard.Id,
		"uid":     dashboard.Uid,
		"url":     dashboard.GetUrl(),
	})
}

func (hs *HTTPServer) dashboardSaveErrorToApiResponse(err error) response.Response {
	var dashboardErr models.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		if body := dashboardErr.Body(); body != nil {
			return response.JSON(dashboardErr.StatusCode, body)
		}
		if dashboardErr.StatusCode != 400 {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), nil)
	}

	if errors.Is(err, models.ErrFolderNotFound) {
		return response.Error(400, err.Error(), nil)
	}

	var validationErr alerting.ValidationError
	if ok := errors.As(err, &validationErr); ok {
		return response.Error(422, validationErr.Error(), err)
	}

	var pluginErr models.UpdatePluginDashboardError
	if ok := errors.As(err, &pluginErr); ok {
		message := fmt.Sprintf("The dashboard belongs to plugin %s.", pluginErr.PluginId)
		// look up plugin name
		if pluginDef := hs.PluginManager.GetPlugin(pluginErr.PluginId); pluginDef != nil {
			message = fmt.Sprintf("The dashboard belongs to plugin %s.", pluginDef.Name)
		}
		return response.JSON(412, util.DynMap{"status": "plugin-dashboard", "message": message})
	}

	return response.Error(500, "Failed to save dashboard", err)
}

// GetHomeDashboard returns the home dashboard.
func (hs *HTTPServer) GetHomeDashboard(c *models.ReqContext) response.Response {
	prefsQuery := models.GetPreferencesWithDefaultsQuery{User: c.SignedInUser}
	homePage := hs.Cfg.HomePage

	if err := hs.Bus.Dispatch(&prefsQuery); err != nil {
		return response.Error(500, "Failed to get preferences", err)
	}

	if prefsQuery.Result.HomeDashboardId == 0 && len(homePage) > 0 {
		homePageRedirect := dtos.DashboardRedirect{RedirectUri: homePage}
		return response.JSON(200, &homePageRedirect)
	}

	if prefsQuery.Result.HomeDashboardId != 0 {
		slugQuery := models.GetDashboardRefByIdQuery{Id: prefsQuery.Result.HomeDashboardId}
		err := hs.Bus.Dispatch(&slugQuery)
		if err == nil {
			url := models.GetDashboardUrl(slugQuery.Result.Uid, slugQuery.Result.Slug)
			dashRedirect := dtos.DashboardRedirect{RedirectUri: url}
			return response.JSON(200, &dashRedirect)
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
	dash.Meta.IsHome = true
	dash.Meta.CanEdit = c.SignedInUser.HasRole(models.ROLE_EDITOR)
	dash.Meta.FolderTitle = "General"

	jsonParser := json.NewDecoder(file)
	if err := jsonParser.Decode(&dash.Dashboard); err != nil {
		return response.Error(500, "Failed to load home dashboard", err)
	}

	hs.addGettingStartedPanelToHomeDashboard(c, dash.Dashboard)

	return response.JSON(200, &dash)
}

func (hs *HTTPServer) addGettingStartedPanelToHomeDashboard(c *models.ReqContext, dash *simplejson.Json) {
	// We only add this getting started panel for Admins who have not dismissed it,
	// and if a custom default home dashboard hasn't been configured
	if !c.HasUserRole(models.ROLE_ADMIN) ||
		c.HasHelpFlag(models.HelpFlagGettingStartedPanelDismissed) ||
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

// GetDashboardVersions returns all dashboard versions as JSON
func GetDashboardVersions(c *models.ReqContext) response.Response {
	dashID := c.ParamsInt64(":dashboardId")

	guardian := guardian.New(dashID, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	query := models.GetDashboardVersionsQuery{
		OrgId:       c.OrgId,
		DashboardId: dashID,
		Limit:       c.QueryInt("limit"),
		Start:       c.QueryInt("start"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(404, fmt.Sprintf("No versions found for dashboardId %d", dashID), err)
	}

	for _, version := range query.Result {
		if version.RestoredFrom == version.Version {
			version.Message = "Initial save (created by migration)"
			continue
		}

		if version.RestoredFrom > 0 {
			version.Message = fmt.Sprintf("Restored from version %d", version.RestoredFrom)
			continue
		}

		if version.ParentVersion == 0 {
			version.Message = "Initial save"
		}
	}

	return response.JSON(200, query.Result)
}

// GetDashboardVersion returns the dashboard version with the given ID.
func GetDashboardVersion(c *models.ReqContext) response.Response {
	dashID := c.ParamsInt64(":dashboardId")

	guardian := guardian.New(dashID, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	query := models.GetDashboardVersionQuery{
		OrgId:       c.OrgId,
		DashboardId: dashID,
		Version:     c.ParamsInt(":id"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, fmt.Sprintf("Dashboard version %d not found for dashboardId %d", query.Version, dashID), err)
	}

	creator := anonString
	if query.Result.CreatedBy > 0 {
		creator = getUserLogin(c.Req.Context(), query.Result.CreatedBy)
	}

	dashVersionMeta := &models.DashboardVersionMeta{
		Id:            query.Result.Id,
		DashboardId:   query.Result.DashboardId,
		Data:          query.Result.Data,
		ParentVersion: query.Result.ParentVersion,
		RestoredFrom:  query.Result.RestoredFrom,
		Version:       query.Result.Version,
		Created:       query.Result.Created,
		Message:       query.Result.Message,
		CreatedBy:     creator,
	}

	return response.JSON(200, dashVersionMeta)
}

// POST /api/dashboards/calculate-diff performs diffs on two dashboards
func CalculateDashboardDiff(c *models.ReqContext, apiOptions dtos.CalculateDiffOptions) response.Response {
	guardianBase := guardian.New(apiOptions.Base.DashboardId, c.OrgId, c.SignedInUser)
	if canSave, err := guardianBase.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	if apiOptions.Base.DashboardId != apiOptions.New.DashboardId {
		guardianNew := guardian.New(apiOptions.New.DashboardId, c.OrgId, c.SignedInUser)
		if canSave, err := guardianNew.CanSave(); err != nil || !canSave {
			return dashboardGuardianResponse(err)
		}
	}

	options := dashdiffs.Options{
		OrgId:    c.OrgId,
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

	result, err := dashdiffs.CalculateDiff(&options)
	if err != nil {
		if errors.Is(err, models.ErrDashboardVersionNotFound) {
			return response.Error(404, "Dashboard version not found", err)
		}
		return response.Error(500, "Unable to compute diff", err)
	}

	if options.DiffType == dashdiffs.DiffDelta {
		return response.Respond(200, result.Delta).SetHeader("Content-Type", "application/json")
	}

	return response.Respond(200, result.Delta).SetHeader("Content-Type", "text/html")
}

// RestoreDashboardVersion restores a dashboard to the given version.
func (hs *HTTPServer) RestoreDashboardVersion(c *models.ReqContext, apiCmd dtos.RestoreDashboardVersionCommand) response.Response {
	dash, rsp := getDashboardHelper(c.Req.Context(), c.OrgId, c.ParamsInt64(":dashboardId"), "")
	if rsp != nil {
		return rsp
	}

	guardian := guardian.New(dash.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	versionQuery := models.GetDashboardVersionQuery{DashboardId: dash.Id, Version: apiCmd.Version, OrgId: c.OrgId}
	if err := bus.Dispatch(&versionQuery); err != nil {
		return response.Error(404, "Dashboard version not found", nil)
	}

	version := versionQuery.Result

	saveCmd := models.SaveDashboardCommand{}
	saveCmd.RestoredFrom = version.Version
	saveCmd.OrgId = c.OrgId
	saveCmd.UserId = c.UserId
	saveCmd.Dashboard = version.Data
	saveCmd.Dashboard.Set("version", dash.Version)
	saveCmd.Dashboard.Set("uid", dash.Uid)
	saveCmd.Message = fmt.Sprintf("Restored from version %d", version.Version)
	saveCmd.FolderId = dash.FolderId

	return hs.PostDashboard(c, saveCmd)
}

func GetDashboardTags(c *models.ReqContext) {
	query := models.GetDashboardTagsQuery{OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get tags from database", err)
		return
	}

	c.JSON(200, query.Result)
}

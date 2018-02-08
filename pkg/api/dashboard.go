package api

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/services/dashboards"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/dashdiffs"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func isDashboardStarredByUser(c *middleware.Context, dashId int64) (bool, error) {
	if !c.IsSignedIn {
		return false, nil
	}

	query := m.IsStarredByUserQuery{UserId: c.UserId, DashboardId: dashId}
	if err := bus.Dispatch(&query); err != nil {
		return false, err
	}

	return query.Result, nil
}

func dashboardGuardianResponse(err error) Response {
	if err != nil {
		return ApiError(500, "Error while checking dashboard permissions", err)
	}

	return ApiError(403, "Access denied to this dashboard", nil)
}

func GetDashboard(c *middleware.Context) Response {
	dash, rsp := getDashboardHelper(c.OrgId, c.Params(":slug"), 0, c.Params(":uid"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dash.Id, c.OrgId, c.SignedInUser)
	if canView, err := guardian.CanView(); err != nil || !canView {
		return dashboardGuardianResponse(err)
	}

	canEdit, _ := guardian.CanEdit()
	canSave, _ := guardian.CanSave()
	canAdmin, _ := guardian.CanAdmin()

	isStarred, err := isDashboardStarredByUser(c, dash.Id)
	if err != nil {
		return ApiError(500, "Error while checking if dashboard was starred by user", err)
	}

	// Finding creator and last updater of the dashboard
	updater, creator := "Anonymous", "Anonymous"
	if dash.UpdatedBy > 0 {
		updater = getUserLogin(dash.UpdatedBy)
	}
	if dash.CreatedBy > 0 {
		creator = getUserLogin(dash.CreatedBy)
	}

	meta := dtos.DashboardMeta{
		IsStarred:   isStarred,
		Slug:        dash.Slug,
		Type:        m.DashTypeDB,
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
		query := m.GetDashboardQuery{Id: dash.FolderId, OrgId: c.OrgId}
		if err := bus.Dispatch(&query); err != nil {
			return ApiError(500, "Dashboard folder could not be read", err)
		}
		meta.FolderTitle = query.Result.Title
		meta.FolderUrl = query.Result.GetUrl()
	}

	// make sure db version is in sync with json model version
	dash.Data.Set("version", dash.Version)

	dto := dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta:      meta,
	}

	c.TimeRequest(metrics.M_Api_Dashboard_Get)
	return Json(200, dto)
}

func getUserLogin(userId int64) string {
	query := m.GetUserByIdQuery{Id: userId}
	err := bus.Dispatch(&query)
	if err != nil {
		return "Anonymous"
	} else {
		user := query.Result
		return user.Login
	}
}

func getDashboardHelper(orgId int64, slug string, id int64, uid string) (*m.Dashboard, Response) {
	var query m.GetDashboardQuery

	if len(uid) > 0 {
		query = m.GetDashboardQuery{Uid: uid, Id: id, OrgId: orgId}
	} else {
		query = m.GetDashboardQuery{Slug: slug, Id: id, OrgId: orgId}
	}

	if err := bus.Dispatch(&query); err != nil {
		return nil, ApiError(404, "Dashboard not found", err)
	}
	return query.Result, nil
}

func DeleteDashboard(c *middleware.Context) Response {
	query := m.GetDashboardsBySlugQuery{OrgId: c.OrgId, Slug: c.Params(":slug")}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to retrieve dashboards by slug", err)
	}

	if len(query.Result) > 1 {
		return Json(412, util.DynMap{"status": "multiple-slugs-exists", "message": m.ErrDashboardsWithSameSlugExists.Error()})
	}

	dash, rsp := getDashboardHelper(c.OrgId, c.Params(":slug"), 0, "")
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dash.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	cmd := m.DeleteDashboardCommand{OrgId: c.OrgId, Id: dash.Id}
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete dashboard", err)
	}

	var resp = map[string]interface{}{"title": dash.Title}
	return Json(200, resp)
}

func DeleteDashboardByUid(c *middleware.Context) Response {
	dash, rsp := getDashboardHelper(c.OrgId, "", 0, c.Params(":uid"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dash.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	cmd := m.DeleteDashboardCommand{OrgId: c.OrgId, Id: dash.Id}
	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to delete dashboard", err)
	}

	var resp = map[string]interface{}{"title": dash.Title}
	return Json(200, resp)
}

func PostDashboard(c *middleware.Context, cmd m.SaveDashboardCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId

	dash := cmd.GetDashboardModel()

	dashId := dash.Id

	// if new dashboard, use parent folder permissions instead
	if dashId == 0 {
		dashId = cmd.FolderId
	}

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	if dash.IsFolder && dash.FolderId > 0 {
		return ApiError(400, m.ErrDashboardFolderCannotHaveParent.Error(), nil)
	}

	// Check if Title is empty
	if dash.Title == "" {
		return ApiError(400, m.ErrDashboardTitleEmpty.Error(), nil)
	}

	if dash.IsFolder && strings.ToLower(dash.Title) == strings.ToLower(m.RootFolderName) {
		return ApiError(400, "A folder already exists with that name", nil)
	}

	if dash.Id == 0 {
		limitReached, err := middleware.QuotaReached(c, "dashboard")
		if err != nil {
			return ApiError(500, "failed to get quota", err)
		}
		if limitReached {
			return ApiError(403, "Quota reached", nil)
		}
	}

	dashItem := &dashboards.SaveDashboardItem{
		Dashboard: dash,
		Message:   cmd.Message,
		OrgId:     c.OrgId,
		UserId:    c.UserId,
		Overwrite: cmd.Overwrite,
	}

	dashboard, err := dashboards.GetRepository().SaveDashboard(dashItem)

	if err == m.ErrDashboardTitleEmpty ||
		err == m.ErrDashboardWithSameNameAsFolder ||
		err == m.ErrDashboardFolderWithSameNameAsDashboard ||
		err == m.ErrDashboardTypeMismatch {
		return ApiError(400, err.Error(), nil)
	}

	if err == m.ErrDashboardContainsInvalidAlertData {
		return ApiError(500, "Invalid alert data. Cannot save dashboard", err)
	}

	if err != nil {
		if err == m.ErrDashboardWithSameUIDExists {
			return Json(412, util.DynMap{"status": "name-exists", "message": err.Error()})
		}
		if err == m.ErrDashboardWithSameNameInFolderExists {
			return Json(412, util.DynMap{"status": "name-exists", "message": err.Error()})
		}
		if err == m.ErrDashboardVersionMismatch {
			return Json(412, util.DynMap{"status": "version-mismatch", "message": err.Error()})
		}
		if pluginErr, ok := err.(m.UpdatePluginDashboardError); ok {
			message := "The dashboard belongs to plugin " + pluginErr.PluginId + "."
			// look up plugin name
			if pluginDef, exist := plugins.Plugins[pluginErr.PluginId]; exist {
				message = "The dashboard belongs to plugin " + pluginDef.Name + "."
			}
			return Json(412, util.DynMap{"status": "plugin-dashboard", "message": message})
		}
		if err == m.ErrDashboardNotFound {
			return Json(404, util.DynMap{"status": "not-found", "message": err.Error()})
		}
		return ApiError(500, "Failed to save dashboard", err)
	}

	if err == m.ErrDashboardFailedToUpdateAlertData {
		return ApiError(500, "Invalid alert data. Cannot save dashboard", err)
	}

	dashboard.IsFolder = dash.IsFolder

	c.TimeRequest(metrics.M_Api_Dashboard_Save)
	return Json(200, util.DynMap{
		"status":  "success",
		"slug":    dashboard.Slug,
		"version": dashboard.Version,
		"id":      dashboard.Id,
		"uid":     dashboard.Uid,
		"url":     dashboard.GetUrl(),
	})
}

func GetHomeDashboard(c *middleware.Context) Response {
	prefsQuery := m.GetPreferencesWithDefaultsQuery{OrgId: c.OrgId, UserId: c.UserId}
	if err := bus.Dispatch(&prefsQuery); err != nil {
		return ApiError(500, "Failed to get preferences", err)
	}

	if prefsQuery.Result.HomeDashboardId != 0 {
		slugQuery := m.GetDashboardRefByIdQuery{Id: prefsQuery.Result.HomeDashboardId}
		err := bus.Dispatch(&slugQuery)
		if err == nil {
			url := m.GetDashboardUrl(slugQuery.Result.Uid, slugQuery.Result.Slug)
			dashRedirect := dtos.DashboardRedirect{RedirectUri: url}
			return Json(200, &dashRedirect)
		} else {
			log.Warn("Failed to get slug from database, %s", err.Error())
		}
	}

	filePath := path.Join(setting.StaticRootPath, "dashboards/home.json")
	file, err := os.Open(filePath)
	if err != nil {
		return ApiError(500, "Failed to load home dashboard", err)
	}

	dash := dtos.DashboardFullWithMeta{}
	dash.Meta.IsHome = true
	dash.Meta.CanEdit = c.SignedInUser.HasRole(m.ROLE_EDITOR)
	dash.Meta.FolderTitle = "General"

	jsonParser := json.NewDecoder(file)
	if err := jsonParser.Decode(&dash.Dashboard); err != nil {
		return ApiError(500, "Failed to load home dashboard", err)
	}

	if c.HasUserRole(m.ROLE_ADMIN) && !c.HasHelpFlag(m.HelpFlagGettingStartedPanelDismissed) {
		addGettingStartedPanelToHomeDashboard(dash.Dashboard)
	}

	return Json(200, &dash)
}

func addGettingStartedPanelToHomeDashboard(dash *simplejson.Json) {
	panels := dash.Get("panels").MustArray()

	newpanel := simplejson.NewFromAny(map[string]interface{}{
		"type": "gettingstarted",
		"id":   123123,
		"gridPos": map[string]interface{}{
			"x": 0,
			"y": 3,
			"w": 24,
			"h": 4,
		},
	})

	panels = append(panels, newpanel)
	dash.Set("panels", panels)
}

// GetDashboardVersions returns all dashboard versions as JSON
func GetDashboardVersions(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	query := m.GetDashboardVersionsQuery{
		OrgId:       c.OrgId,
		DashboardId: dashId,
		Limit:       c.QueryInt("limit"),
		Start:       c.QueryInt("start"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(404, fmt.Sprintf("No versions found for dashboardId %d", dashId), err)
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

	return Json(200, query.Result)
}

// GetDashboardVersion returns the dashboard version with the given ID.
func GetDashboardVersion(c *middleware.Context) Response {
	dashId := c.ParamsInt64(":dashboardId")

	guardian := guardian.NewDashboardGuardian(dashId, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	query := m.GetDashboardVersionQuery{
		OrgId:       c.OrgId,
		DashboardId: dashId,
		Version:     c.ParamsInt(":id"),
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, fmt.Sprintf("Dashboard version %d not found for dashboardId %d", query.Version, dashId), err)
	}

	creator := "Anonymous"
	if query.Result.CreatedBy > 0 {
		creator = getUserLogin(query.Result.CreatedBy)
	}

	dashVersionMeta := &m.DashboardVersionMeta{
		DashboardVersion: *query.Result,
		CreatedBy:        creator,
	}

	return Json(200, dashVersionMeta)
}

// POST /api/dashboards/calculate-diff performs diffs on two dashboards
func CalculateDashboardDiff(c *middleware.Context, apiOptions dtos.CalculateDiffOptions) Response {

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
		if err == m.ErrDashboardVersionNotFound {
			return ApiError(404, "Dashboard version not found", err)
		}
		return ApiError(500, "Unable to compute diff", err)
	}

	if options.DiffType == dashdiffs.DiffDelta {
		return Respond(200, result.Delta).Header("Content-Type", "application/json")
	} else {
		return Respond(200, result.Delta).Header("Content-Type", "text/html")
	}
}

// RestoreDashboardVersion restores a dashboard to the given version.
func RestoreDashboardVersion(c *middleware.Context, apiCmd dtos.RestoreDashboardVersionCommand) Response {
	dash, rsp := getDashboardHelper(c.OrgId, "", c.ParamsInt64(":dashboardId"), "")
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dash.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	versionQuery := m.GetDashboardVersionQuery{DashboardId: dash.Id, Version: apiCmd.Version, OrgId: c.OrgId}
	if err := bus.Dispatch(&versionQuery); err != nil {
		return ApiError(404, "Dashboard version not found", nil)
	}

	version := versionQuery.Result

	saveCmd := m.SaveDashboardCommand{}
	saveCmd.RestoredFrom = version.Version
	saveCmd.OrgId = c.OrgId
	saveCmd.UserId = c.UserId
	saveCmd.Dashboard = version.Data
	saveCmd.Dashboard.Set("version", dash.Version)
	saveCmd.Dashboard.Set("uid", dash.Uid)
	saveCmd.Message = fmt.Sprintf("Restored from version %d", version.Version)

	return PostDashboard(c, saveCmd)
}

func GetDashboardTags(c *middleware.Context) {
	query := m.GetDashboardTagsQuery{OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get tags from database", err)
		return
	}

	c.JSON(200, query.Result)
}

func GetFoldersForSignedInUser(c *middleware.Context) Response {
	title := c.Query("query")
	query := m.GetFoldersForSignedInUserQuery{
		OrgId:        c.OrgId,
		SignedInUser: c.SignedInUser,
		Title:        title,
	}

	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to get folders from database", err)
	}

	return Json(200, query.Result)
}

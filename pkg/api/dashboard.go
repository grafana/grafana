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

func GetDashboard(c *middleware.Context) {
	slug := strings.ToLower(c.Params(":slug"))

	query := m.GetDashboardQuery{Slug: slug, OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	isStarred, err := isDashboardStarredByUser(c, query.Result.Id)
	if err != nil {
		c.JsonApiErr(500, "Error while checking if dashboard was starred by user", err)
		return
	}

	dash := query.Result

	// Finding creator and last updater of the dashboard
	updater, creator := "Anonymous", "Anonymous"
	if dash.UpdatedBy > 0 {
		updater = getUserLogin(dash.UpdatedBy)
	}
	if dash.CreatedBy > 0 {
		creator = getUserLogin(dash.CreatedBy)
	}

	// make sure db version is in sync with json model version
	dash.Data.Set("version", dash.Version)

	dto := dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta: dtos.DashboardMeta{
			IsStarred: isStarred,
			Slug:      slug,
			Type:      m.DashTypeDB,
			CanStar:   c.IsSignedIn,
			CanSave:   c.OrgRole == m.ROLE_ADMIN || c.OrgRole == m.ROLE_EDITOR,
			CanEdit:   canEditDashboard(c.OrgRole),
			Created:   dash.Created,
			Updated:   dash.Updated,
			UpdatedBy: updater,
			CreatedBy: creator,
			Version:   dash.Version,
		},
	}

	// TODO(ben): copy this performance metrics logic for the new API endpoints added
	c.TimeRequest(metrics.M_Api_Dashboard_Get)
	c.JSON(200, dto)
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

func DeleteDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	query := m.GetDashboardQuery{Slug: slug, OrgId: c.OrgId}
	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	cmd := m.DeleteDashboardCommand{Slug: slug, OrgId: c.OrgId}
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to delete dashboard", err)
		return
	}

	var resp = map[string]interface{}{"title": query.Result.Title}

	c.JSON(200, resp)
}

func PostDashboard(c *middleware.Context, cmd m.SaveDashboardCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId

	dash := cmd.GetDashboardModel()

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
	}

	dashboard, err := dashboards.GetRepository().SaveDashboard(dashItem)

	if err == m.ErrDashboardTitleEmpty {
		return ApiError(400, m.ErrDashboardTitleEmpty.Error(), nil)
	}

	if err == m.ErrDashboardContainsInvalidAlertData {
		return ApiError(500, "Invalid alert data. Cannot save dashboard", err)
	}

	if err != nil {
		if err == m.ErrDashboardWithSameNameExists {
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

	c.TimeRequest(metrics.M_Api_Dashboard_Save)
	return Json(200, util.DynMap{"status": "success", "slug": dashboard.Slug, "version": dashboard.Version})
}

func canEditDashboard(role m.RoleType) bool {
	return role == m.ROLE_ADMIN || role == m.ROLE_EDITOR || role == m.ROLE_READ_ONLY_EDITOR
}

func GetHomeDashboard(c *middleware.Context) Response {
	prefsQuery := m.GetPreferencesWithDefaultsQuery{OrgId: c.OrgId, UserId: c.UserId}
	if err := bus.Dispatch(&prefsQuery); err != nil {
		return ApiError(500, "Failed to get preferences", err)
	}

	if prefsQuery.Result.HomeDashboardId != 0 {
		slugQuery := m.GetDashboardSlugByIdQuery{Id: prefsQuery.Result.HomeDashboardId}
		err := bus.Dispatch(&slugQuery)
		if err == nil {
			dashRedirect := dtos.DashboardRedirect{RedirectUri: "db/" + slugQuery.Result}
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
	dash.Meta.CanEdit = canEditDashboard(c.OrgRole)
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
	rows := dash.Get("rows").MustArray()
	row := simplejson.NewFromAny(rows[0])

	newpanel := simplejson.NewFromAny(map[string]interface{}{
		"type": "gettingstarted",
		"id":   123123,
		"span": 12,
	})

	panels := row.Get("panels").MustArray()
	panels = append(panels, newpanel)
	row.Set("panels", panels)
}

// GetDashboardVersions returns all dashboard versions as JSON
func GetDashboardVersions(c *middleware.Context) Response {
	dashboardId := c.ParamsInt64(":dashboardId")
	limit := c.QueryInt("limit")
	start := c.QueryInt("start")

	if limit == 0 {
		limit = 1000
	}

	query := m.GetDashboardVersionsQuery{
		OrgId:       c.OrgId,
		DashboardId: dashboardId,
		Limit:       limit,
		Start:       start,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(404, fmt.Sprintf("No versions found for dashboardId %d", dashboardId), err)
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
	dashboardId := c.ParamsInt64(":dashboardId")
	version := c.ParamsInt(":id")

	query := m.GetDashboardVersionQuery{
		OrgId:       c.OrgId,
		DashboardId: dashboardId,
		Version:     version,
	}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, fmt.Sprintf("Dashboard version %d not found for dashboardId %d", version, dashboardId), err)
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
	dashboardId := c.ParamsInt64(":dashboardId")

	dashQuery := m.GetDashboardQuery{Id: dashboardId, OrgId: c.OrgId}
	if err := bus.Dispatch(&dashQuery); err != nil {
		return ApiError(404, "Dashboard not found", nil)
	}

	versionQuery := m.GetDashboardVersionQuery{DashboardId: dashboardId, Version: apiCmd.Version, OrgId: c.OrgId}
	if err := bus.Dispatch(&versionQuery); err != nil {
		return ApiError(404, "Dashboard version not found", nil)
	}

	dashboard := dashQuery.Result
	version := versionQuery.Result

	saveCmd := m.SaveDashboardCommand{}
	saveCmd.RestoredFrom = version.Version
	saveCmd.OrgId = c.OrgId
	saveCmd.UserId = c.UserId
	saveCmd.Dashboard = version.Data
	saveCmd.Dashboard.Set("version", dashboard.Version)
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

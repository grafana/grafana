package api

import (
	"encoding/json"
	"os"
	"path"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func isDasboardStarredByUser(c *middleware.Context, dashId int64) (bool, error) {
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
	metrics.M_Api_Dashboard_Get.Inc(1)

	slug := strings.ToLower(c.Params(":slug"))

	query := m.GetDashboardQuery{Slug: slug, OrgId: c.OrgId}
	err := bus.Dispatch(&query)
	if err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	isStarred, err := isDasboardStarredByUser(c, query.Result.Id)
	if err != nil {
		c.JsonApiErr(500, "Error while checking if dashboard was starred by user", err)
		return
	}

	dash := query.Result

	// Finding the last updater of the dashboard
	updater := "Anonymous"
	if dash.UpdatedBy != 0 {
		userQuery := m.GetUserByIdQuery{Id: dash.UpdatedBy}
		userErr := bus.Dispatch(&userQuery)
		if userErr != nil {
			updater = "Unknown"
		} else {
			user := userQuery.Result
			updater = user.Login
		}
	}

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
		},
	}

	c.JSON(200, dto)
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

func PostDashboard(c *middleware.Context, cmd m.SaveDashboardCommand) {
	cmd.OrgId = c.OrgId

	if !c.IsSignedIn {
		cmd.UpdatedBy = 0
	} else {
		cmd.UpdatedBy = c.UserId
	}

	dash := cmd.GetDashboardModel()
	if dash.Id == 0 {
		limitReached, err := middleware.QuotaReached(c, "dashboard")
		if err != nil {
			c.JsonApiErr(500, "failed to get quota", err)
			return
		}
		if limitReached {
			c.JsonApiErr(403, "Quota reached", nil)
			return
		}
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		if err == m.ErrDashboardWithSameNameExists {
			c.JSON(412, util.DynMap{"status": "name-exists", "message": err.Error()})
			return
		}
		if err == m.ErrDashboardVersionMismatch {
			c.JSON(412, util.DynMap{"status": "version-mismatch", "message": err.Error()})
			return
		}
		if err == m.ErrDashboardNotFound {
			c.JSON(404, util.DynMap{"status": "not-found", "message": err.Error()})
			return
		}
		c.JsonApiErr(500, "Failed to save dashboard", err)
		return
	}

	metrics.M_Api_Dashboard_Post.Inc(1)

	c.JSON(200, util.DynMap{"status": "success", "slug": cmd.Result.Slug, "version": cmd.Result.Version})
}

func canEditDashboard(role m.RoleType) bool {
	return role == m.ROLE_ADMIN || role == m.ROLE_EDITOR || role == m.ROLE_READ_ONLY_EDITOR
}

func GetHomeDashboard(c *middleware.Context) {
	filePath := path.Join(setting.StaticRootPath, "dashboards/home.json")
	file, err := os.Open(filePath)
	if err != nil {
		c.JsonApiErr(500, "Failed to load home dashboard", err)
		return
	}

	dash := dtos.DashboardFullWithMeta{}
	dash.Meta.IsHome = true
	dash.Meta.CanEdit = canEditDashboard(c.OrgRole)
	jsonParser := json.NewDecoder(file)
	if err := jsonParser.Decode(&dash.Dashboard); err != nil {
		c.JsonApiErr(500, "Failed to load home dashboard", err)
		return
	}

	c.JSON(200, &dash)
}

func GetDashboardFromJsonFile(c *middleware.Context) {
	file := c.Params(":file")

	dashboard := search.GetDashboardFromJsonIndex(file)
	if dashboard == nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	dash := dtos.DashboardFullWithMeta{Dashboard: dashboard.Data}
	dash.Meta.Type = m.DashTypeJson
	dash.Meta.CanEdit = canEditDashboard(c.OrgRole)

	c.JSON(200, &dash)
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

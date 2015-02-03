package api

import (
	"encoding/json"
	"os"
	"path"

	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
	"github.com/torkelo/grafana-pro/pkg/util"
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
	slug := c.Params(":slug")

	query := m.GetDashboardQuery{Slug: slug, AccountId: c.AccountId}
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
	dto := dtos.Dashboard{
		Model: dash.Data,
		Meta:  dtos.DashboardMeta{IsStarred: isStarred},
	}

	c.JSON(200, dto)
}

func DeleteDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	query := m.GetDashboardQuery{Slug: slug, AccountId: c.AccountId}
	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	cmd := m.DeleteDashboardCommand{Slug: slug, AccountId: c.AccountId}
	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to delete dashboard", err)
		return
	}

	var resp = map[string]interface{}{"title": query.Result.Title}

	c.JSON(200, resp)
}

func PostDashboard(c *middleware.Context, cmd m.SaveDashboardCommand) {
	cmd.AccountId = c.AccountId

	err := bus.Dispatch(&cmd)
	if err != nil {
		if err == m.ErrDashboardWithSameNameExists {
			c.JsonApiErr(400, "Dashboard with the same title already exists", nil)
			return
		}
		c.JsonApiErr(500, "Failed to save dashboard", err)
		return
	}

	c.JSON(200, util.DynMap{"status": "success", "slug": cmd.Result.Slug})
}

func GetHomeDashboard(c *middleware.Context) {
	filePath := path.Join(setting.StaticRootPath, "dashboards/home.json")
	file, err := os.Open(filePath)
	if err != nil {
		c.JsonApiErr(500, "Failed to load home dashboard", err)
		return
	}

	dash := dtos.Dashboard{}
	dash.Meta.IsHome = true
	jsonParser := json.NewDecoder(file)
	if err := jsonParser.Decode(&dash.Model); err != nil {
		c.JsonApiErr(500, "Failed to load home dashboard", err)
		return
	}

	c.JSON(200, &dash)
}

package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

func GetDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	dash, err := m.GetDashboard(slug, c.GetAccountId())
	if err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	dash.Data["id"] = dash.Id

	c.JSON(200, dash.Data)
}

func DeleteDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	dash, err := m.GetDashboard(slug, c.GetAccountId())
	if err != nil {
		c.JsonApiErr(404, "Dashboard not found", nil)
		return
	}

	err = m.DeleteDashboard(slug, c.GetAccountId())
	if err != nil {
		c.JsonApiErr(500, "Failed to delete dashboard", err)
		return
	}

	var resp = map[string]interface{}{"title": dash.Title}

	c.JSON(200, resp)
}

func Search(c *middleware.Context) {
	query := c.Query("q")

	results, err := m.SearchQuery(query, c.GetAccountId())
	if err != nil {
		c.JsonApiErr(500, "Search failed", err)
		return
	}

	c.JSON(200, results)
}

func PostDashboard(c *middleware.Context) {
	var cmd m.SaveDashboardCommand

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "bad request", nil)
		return
	}

	cmd.AccountId = c.GetAccountId()

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to save dashboard", err)
		return
	}

	c.JSON(200, utils.DynMap{"status": "success", "slug": cmd.Result.Slug})
}

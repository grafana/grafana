package api

import (
	"github.com/gin-gonic/gin"

	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/routes/apimodel"
)

func GetDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	dash, err := models.GetDashboard(slug, c.GetAccountId())
	if err != nil {
		c.ApiError(404, "Dashboard not found", nil)
		return
	}

	dash.Data["id"] = dash.Id

	c.JSON(200, dash.Data)
}

func DeleteDashboard(c *middleware.Context) {
	slug := c.Params(":slug")

	dash, err := models.GetDashboard(slug, c.GetAccountId())
	if err != nil {
		c.ApiError(404, "Dashboard not found", nil)
		return
	}

	err = models.DeleteDashboard(slug, c.GetAccountId())
	if err != nil {
		c.ApiError(500, "Failed to delete dashboard", err)
		return
	}

	var resp = map[string]interface{}{"title": dash.Title}

	c.JSON(200, resp)
}

func Search(c *middleware.Context) {
	query := c.Query("q")

	results, err := models.SearchQuery(query, c.GetAccountId())
	if err != nil {
		c.ApiError(500, "Search failed", err)
		return
	}

	c.JSON(200, results)
}

func PostDashboard(c *middleware.Context) {
	var command apimodel.SaveDashboardCommand

	if !c.JsonBody(&command) {
		c.ApiError(400, "bad request", nil)
		return
	}

	dashboard := models.NewDashboard("test")
	dashboard.Data = command.Dashboard
	dashboard.Title = dashboard.Data["title"].(string)
	dashboard.AccountId = c.GetAccountId()
	dashboard.UpdateSlug()

	if dashboard.Data["id"] != nil {
		dashboard.Id = dashboard.Data["id"].(string)
	}

	err := models.SaveDashboard(dashboard)
	if err != nil {
		c.ApiError(500, "Failed to save dashboard", err)
		return
	}

	c.JSON(200, gin.H{"status": "success", "slug": dashboard.Slug})
}

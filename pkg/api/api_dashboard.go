package api

import (
	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.addRoute("GET", "/api/dashboards/:slug", self.getDashboard)
		self.addRoute("GET", "/api/search/", self.search)
		self.addRoute("POST", "/api/dashboard/", self.postDashboard)
		self.addRoute("DELETE", "/api/dashboard/:slug", self.deleteDashboard)
	})
}

func (self *HttpServer) getDashboard(c *gin.Context, auth *authContext) {
	slug := c.Params.ByName("slug")

	dash, err := self.store.GetDashboard(slug, auth.getAccountId())
	if err != nil {
		c.JSON(404, newErrorResponse("Dashboard not found"))
		return
	}

	dash.Data["id"] = dash.Id

	c.JSON(200, dash.Data)
}

func (self *HttpServer) deleteDashboard(c *gin.Context, auth *authContext) {
	slug := c.Params.ByName("slug")

	dash, err := self.store.GetDashboard(slug, auth.getAccountId())
	if err != nil {
		c.JSON(404, newErrorResponse("Dashboard not found"))
		return
	}

	err = self.store.DeleteDashboard(slug, auth.getAccountId())
	if err != nil {
		c.JSON(500, newErrorResponse("Failed to delete dashboard: "+err.Error()))
		return
	}

	var resp = map[string]interface{}{"title": dash.Title}

	c.JSON(200, resp)
}

func (self *HttpServer) search(c *gin.Context, auth *authContext) {
	query := c.Params.ByName("q")

	results, err := self.store.Query(query, auth.getAccountId())
	if err != nil {
		log.Error("Store query error: %v", err)
		c.JSON(500, newErrorResponse("Failed"))
		return
	}

	c.JSON(200, results)
}

func (self *HttpServer) postDashboard(c *gin.Context, auth *authContext) {
	var command saveDashboardCommand

	if c.EnsureBody(&command) {
		dashboard := models.NewDashboard("test")
		dashboard.Data = command.Dashboard
		dashboard.Title = dashboard.Data["title"].(string)
		dashboard.AccountId = auth.getAccountId()
		dashboard.UpdateSlug()

		if dashboard.Data["id"] != nil {
			dashboard.Id = dashboard.Data["id"].(string)
		}

		err := self.store.SaveDashboard(dashboard)
		if err == nil {
			c.JSON(200, gin.H{"status": "success", "slug": dashboard.Slug})
			return
		}
	}

	c.JSON(500, gin.H{"error": "bad request"})
}

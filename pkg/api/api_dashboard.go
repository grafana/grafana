package api

import (
	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/api/dashboards/:slug", self.auth(), self.getDashboard)
		self.router.GET("/api/search/", self.auth(), self.search)
		self.router.POST("/api/dashboard", self.auth(), self.postDashboard)
		self.router.DELETE("/api/dashboard/:slug", self.auth(), self.deleteDashboard)
	})
}

func (self *HttpServer) getDashboard(c *gin.Context) {
	slug := c.Params.ByName("slug")
	accountId, err := c.Get("accountId")

	dash, err := self.store.GetDashboard(slug, accountId.(int))
	if err != nil {
		c.JSON(404, newErrorResponse("Dashboard not found"))
		return
	}

	dash.Data["id"] = dash.Id

	c.JSON(200, dash.Data)
}

func (self *HttpServer) deleteDashboard(c *gin.Context) {
	slug := c.Params.ByName("slug")
	accountId, err := c.Get("accountId")

	dash, err := self.store.GetDashboard(slug, accountId.(int))
	if err != nil {
		c.JSON(404, newErrorResponse("Dashboard not found"))
		return
	}

	err = self.store.DeleteDashboard(slug, accountId.(int))
	if err != nil {
		c.JSON(500, newErrorResponse("Failed to delete dashboard: "+err.Error()))
		return
	}

	var resp = map[string]interface{}{"title": dash.Title}

	c.JSON(200, resp)
}

func (self *HttpServer) search(c *gin.Context) {
	query := c.Params.ByName("q")
	accountId, err := c.Get("accountId")

	results, err := self.store.Query(query, accountId.(int))
	if err != nil {
		log.Error("Store query error: %v", err)
		c.JSON(500, newErrorResponse("Failed"))
		return
	}

	c.JSON(200, results)
}

func (self *HttpServer) postDashboard(c *gin.Context) {
	var command saveDashboardCommand
	accountId, _ := c.Get("accountId")

	if c.EnsureBody(&command) {
		dashboard := models.NewDashboard("test")
		dashboard.Data = command.Dashboard
		dashboard.Title = dashboard.Data["title"].(string)
		dashboard.AccountId = accountId.(int)
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

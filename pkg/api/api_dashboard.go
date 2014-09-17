package api

import (
	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/api/dashboards/:id", self.auth(), self.getDashboard)
		self.router.GET("/api/search/", self.auth(), self.search)
		self.router.POST("/api/dashboard", self.auth(), self.postDashboard)
	})
}

func (self *HttpServer) getDashboard(c *gin.Context) {
	id := c.Params.ByName("id")
	accountId, err := c.Get("accountId")

	dash, err := self.store.GetDashboard(id, accountId.(int))
	if err != nil {
		c.JSON(404, newErrorResponse("Dashboard not found"))
		return
	}

	c.JSON(200, dash.Data)
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

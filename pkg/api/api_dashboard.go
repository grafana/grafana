package api

import (
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/api/dashboards/:id", self.getDashboard)
		self.router.GET("/api/search/", self.search)
		self.router.POST("/api/dashboard", self.postDashboard)
	})
}

func (self *HttpServer) getDashboard(c *gin.Context) {
	id := c.Params.ByName("id")

	dash, err := self.store.GetById(id)
	if err != nil {
		c.JSON(404, newErrorResponse("Dashboard not found"))
		return
	}

	c.JSON(200, dash.Data)
}

func (self *HttpServer) search(c *gin.Context) {
	query := c.Params.ByName("q")

	results, err := self.store.Query(query)
	if err != nil {
		c.JSON(500, newErrorResponse("Failed"))
		return
	}

	c.JSON(200, results)
}

func (self *HttpServer) postDashboard(c *gin.Context) {
	var command saveDashboardCommand

	if c.EnsureBody(&command) {
		err := self.store.Save(&models.Dashboard{Data: command.Dashboard})
		if err == nil {
			c.JSON(200, gin.H{"status": "saved"})
			return
		}
	}

	c.JSON(500, gin.H{"error": "bad request"})
}

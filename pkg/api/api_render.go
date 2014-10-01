package api

import (
	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/api/render/*url", self.renderToPng)
	})
}

func (self *HttpServer) renderToPng(c *gin.Context) {
	url := c.Params.ByName("url")
	log.Info("Rendering url %v", url)
	pngPath, err := self.renderer.RenderToPng("http://localhost:3000/" + url)
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.File(pngPath)
}

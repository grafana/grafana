package api

import (
	"strconv"

	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.addRoute("GET", "/api/render/*url", self.renderToPng)
	})
}

func (self *HttpServer) renderToPng(c *gin.Context, auth *authContext) {
	url := c.Params.ByName("url")
	accountId := auth.getAccountId()

	log.Info("Rendering url %v", url)
	pngPath, err := self.renderer.RenderToPng("http://localhost:3000" + url + "?render&accountId=" + strconv.Itoa(accountId))
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.File(pngPath)
}

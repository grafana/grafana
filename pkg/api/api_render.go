package api

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/components"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.addRoute("GET", "/render/*url", self.renderToPng)
	})
}

func (self *HttpServer) renderToPng(c *gin.Context, auth *authContext) {
	accountId := auth.getAccountId()
	query := c.Request.URL.Query()
	queryParams := "?render&accountId=" + strconv.Itoa(accountId) + "&" + c.Request.URL.RawQuery
	renderOpts := &components.RenderOpts{
		Url:    c.Params.ByName("url") + queryParams,
		Width:  query["width"][0],
		Height: query["height"][0],
	}

	renderOpts.Url = "http://localhost:3000" + renderOpts.Url

	pngPath, err := self.renderer.RenderToPng(renderOpts)
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.File(pngPath)
}

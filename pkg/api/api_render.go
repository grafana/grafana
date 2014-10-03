package api

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/components"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.addRoute("GET", "/render/*url", self.renderToPng)
	})
}

func (self *HttpServer) renderToPng(c *gin.Context, auth *authContext) {
	accountId := auth.getAccountId()
	queryReader := utils.NewUrlQueryReader(c.Request.URL)
	queryParams := "?render&accountId=" + strconv.Itoa(accountId) + "&" + c.Request.URL.RawQuery

	renderOpts := &components.RenderOpts{
		Url:    c.Params.ByName("url") + queryParams,
		Width:  queryReader.Get("width", "800"),
		Height: queryReader.Get("height", "400"),
	}

	renderOpts.Url = "http://localhost:3000" + renderOpts.Url

	pngPath, err := self.renderer.RenderToPng(renderOpts)
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.File(pngPath)
}

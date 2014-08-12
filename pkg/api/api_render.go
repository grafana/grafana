package api

import "github.com/gin-gonic/gin"

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/api/render", self.renderToPng)
	})
}

func (self *HttpServer) renderToPng(c *gin.Context) {
	qs := c.Request.URL.Query()
	url := qs["url"][0]
	pngPath, err := self.renderer.RenderToPng(url)
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.File(pngPath)
}

package api

import (
	"strconv"

	"github.com/torkelo/grafana-pro/pkg/components/renderer"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

func RenderToPng(c *middleware.Context) {
	accountId := c.GetAccountId()
	queryReader := utils.NewUrlQueryReader(c.Req.URL)
	queryParams := "?render&accountId=" + strconv.Itoa(accountId) + "&" + c.Req.URL.RawQuery

	renderOpts := &renderer.RenderOpts{
		Url:    c.Params("url") + queryParams,
		Width:  queryReader.Get("width", "800"),
		Height: queryReader.Get("height", "400"),
	}

	renderOpts.Url = "http://localhost:3000" + renderOpts.Url

	pngPath, err := renderer.RenderToPng(renderOpts)
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.ServeFile(pngPath)
}

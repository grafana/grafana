package api

import (
	"net/http"
	"strconv"

	"github.com/torkelo/grafana-pro/pkg/components/renderer"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/util"
)

func RenderToPng(c *middleware.Context) {
	accountId := c.UsingAccountId
	queryReader := util.NewUrlQueryReader(c.Req.URL)
	queryParams := "?render=1&accountId=" + strconv.FormatInt(accountId, 10) + "&" + c.Req.URL.RawQuery

	renderOpts := &renderer.RenderOpts{
		Url:    c.Params("*") + queryParams,
		Width:  queryReader.Get("width", "800"),
		Height: queryReader.Get("height", "400"),
	}

	renderOpts.Url = "http://localhost:3000/" + renderOpts.Url

	pngPath, err := renderer.RenderToPng(renderOpts)
	if err != nil {
		c.HTML(500, "error.html", nil)
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	http.ServeFile(c.Resp, c.Req.Request, pngPath)
}

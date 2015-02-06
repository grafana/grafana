package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/components/renderer"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util"
)

func RenderToPng(c *middleware.Context) {
	queryReader := util.NewUrlQueryReader(c.Req.URL)
	queryParams := fmt.Sprintf("?render=1&%s=%d&%s", middleware.SESS_KEY_USERID, c.UserId, c.Req.URL.RawQuery)

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

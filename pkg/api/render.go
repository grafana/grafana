package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/components/renderer"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util"
)

func RenderToPng(c *middleware.Context) {
	queryReader, err := util.NewUrlQueryReader(c.Req.URL)
	if err != nil {
		c.Handle(400, "Render parameters error", err)
		return
	}
	queryParams := fmt.Sprintf("?%s", c.Req.URL.RawQuery)

	renderOpts := &renderer.RenderOpts{
		Path:     c.Params("*") + queryParams,
		Width:    queryReader.Get("width", "800"),
		Height:   queryReader.Get("height", "400"),
		OrgId:    c.OrgId,
		Timeout:  queryReader.Get("timeout", "60"),
		Timezone: queryReader.Get("tz", ""),
		Encoding: queryReader.Get("encoding", ""),
	}

	pngPath, err := renderer.RenderToPng(renderOpts)

	if err != nil {
		if err == renderer.ErrTimeout {
			c.Handle(500, err.Error(), err)
		}

		c.Handle(500, "Rendering failed.", err)
		return
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	http.ServeFile(c.Resp, c.Req.Request, pngPath)
}
